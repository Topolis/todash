// ABOUTME: Collects runtime data from the Shelly Gen3 controller for dashboard widgets.
// ABOUTME: Aggregates thermostat, script, action, and schedule state via RPC calls.

import { logger } from '@lib/logger';
import { callShelly, resolveShellyConnectionOptions, ShellyRpcError } from './controller';

export interface ShellyThermostatConfig {
  id: string;
  label?: string;
}

export interface ShellyWidgetConfig {
  refreshSeconds?: number;
  thermostats?: ShellyThermostatConfig[];
  includeScripts?: boolean;
  includeActions?: boolean;
  includeSchedules?: boolean;
  scriptIds?: number[];
  actionIds?: string[];
  scheduleIds?: number[];
}

export interface ShellyControllerInfo {
  name?: string;
  model?: string;
  firmware?: string;
  mac?: string;
  uptimeSeconds?: number;
  url?: string;
}

export interface ShellyThermostatState {
  id: string;
  label?: string;
  status?: string;
  mode?: string;
  targetTemperature?: number;
  currentTemperature?: number;
  battery?: number;
  valvePosition?: number;
  humidity?: number;
  online?: boolean;
  lastUpdateTs?: number;
  rawStatus?: Record<string, unknown> | null;
}

export interface ShellyScriptState {
  id: number;
  name: string;
  enabled: boolean;
  running: boolean;
  lastRunTs?: number;
  raw?: Record<string, unknown> | null;
}

export interface ShellyActionState {
  id: string;
  name: string;
  enabled?: boolean;
  group?: string;
  raw?: Record<string, unknown> | null;
}

export interface ShellyScheduleState {
  id: number;
  name: string;
  enabled: boolean;
  nextRunTs?: number;
  raw?: Record<string, unknown> | null;
}

export interface ShellyWidgetData {
  controller: ShellyControllerInfo | null;
  thermostats: ShellyThermostatState[];
  scripts: ShellyScriptState[];
  actions: ShellyActionState[];
  schedules: ShellyScheduleState[];
  controllerUrl: string | null;
  authError: string | null;
}

const NUMERIC_FIELDS = ['target_C', 'target_t', 'target', 'targetTemperature', 'targetTemp'];
const CURRENT_FIELDS = ['current_C', 'current_t', 'current', 'currentTemperature', 'temperature'];
const BATTERY_FIELDS = ['battery', 'battery_percent', 'percent'];
const VALVE_FIELDS = ['position', 'pos', 'value'];
const MODE_FIELDS = ['mode', 'thermostat_mode'];
const STATUS_FIELDS = ['status', 'state'];
const ENABLE_FIELDS = ['enable', 'enabled'];
const RUNNING_FIELDS = ['running', 'active'];
const NEXT_RUN_FIELDS = ['next', 'next_run', 'next_ts', 'next_run_ts'];
const NAME_FIELDS = ['label', 'name', 'title'];
const GROUP_FIELDS = ['group', 'category'];

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

function pickFirst<T>(source: Record<string, unknown> | undefined | null, keys: string[], mapper: (val: unknown) => T | undefined): T | undefined {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = mapper((source as Record<string, unknown>)[key]);
      if (value !== undefined) {
        return value;
      }
    }
  }

  return undefined;
}

function extractFromAny(source: unknown, keys: string[], mapper: (val: unknown) => any): any {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  return pickFirst(source as Record<string, unknown>, keys, mapper);
}

async function loadThermostatConfigs(config?: ShellyWidgetConfig): Promise<ShellyThermostatConfig[]> {
  if (config?.thermostats && config.thermostats.length > 0) {
    return config.thermostats;
  }

  try {
    const result = await callShelly('Thermostat.List');
    const thermostats = Array.isArray(result?.thermostats) ? result.thermostats : [];

    return thermostats.map((item: any) => ({
      id: String(item?.id ?? item?.name ?? item?.mac ?? ''),
      label: item?.name ?? item?.label ?? item?.room,
    })).filter((t: ShellyThermostatConfig) => Boolean(t.id));
  } catch (error) {
    if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
      throw error;
    }
    if (error instanceof ShellyRpcError && (error.status === 404 || error.code === 404)) {
      logger.info('Shelly', 'Shelly controller does not expose Thermostat.List; using provided config only');
      return [];
    }
    logger.warn('Shelly', 'Failed to fetch thermostat list', error);
    return [];
  }
}

function parseThermostatStatus(id: string, baseLabel: string | undefined, payload: any): ShellyThermostatState {
  const root = payload ?? {};
  const thermostat = root?.thermostat ?? root;

  const label = baseLabel ?? root?.name ?? root?.label ?? root?.room ?? id;

  const targetTemperature = extractFromAny(thermostat, NUMERIC_FIELDS, coerceNumber) ?? coerceNumber(root?.target_t);
  const currentTemperature = extractFromAny(thermostat, CURRENT_FIELDS, coerceNumber) ?? coerceNumber(root?.current_t);

  let battery: number | undefined;
  if (root?.battery && typeof root.battery === 'object') {
    battery = extractFromAny(root.battery, BATTERY_FIELDS, coerceNumber);
  }
  battery = battery ?? coerceNumber(root?.battery);

  let valvePosition: number | undefined;
  if (root?.valve && typeof root.valve === 'object') {
    valvePosition = extractFromAny(root.valve, VALVE_FIELDS, coerceNumber);
  }
  valvePosition = valvePosition ?? coerceNumber(root?.pos) ?? coerceNumber(root?.valve_position);

  const mode = extractFromAny(thermostat, MODE_FIELDS, value => (typeof value === 'string' ? value : undefined)) ?? (typeof root?.mode === 'string' ? root.mode : undefined);
  const status = extractFromAny(root, STATUS_FIELDS, value => (typeof value === 'string' ? value : undefined));
  const humidity = coerceNumber(root?.humidity ?? thermostat?.humidity);
  const online = coerceBoolean(root?.online ?? thermostat?.online ?? root?.paired);
  const lastUpdateTs = coerceNumber(root?.last_updated_ts ?? root?.ts ?? root?.timestamp ?? root?._updated);

  return {
    id,
    label,
    status,
    mode,
    targetTemperature,
    currentTemperature,
    battery,
    valvePosition,
    humidity,
    online,
    lastUpdateTs,
    rawStatus: typeof payload === 'object' && payload !== null ? payload : null,
  };
}

function parseScripts(result: any, filterIds?: Set<number>): ShellyScriptState[] {
  const scripts = Array.isArray(result?.scripts) ? result.scripts : [];

  return scripts
    .filter((script: any) => {
      const id = Number(script?.id);
      if (!Number.isFinite(id)) {
        return false;
      }
      return !filterIds || filterIds.has(id);
    })
    .map((script: any) => {
      const id = Number(script.id);
      const enabled = !!(extractFromAny(script, ENABLE_FIELDS, coerceBoolean) ?? false);
      const running = !!(extractFromAny(script, RUNNING_FIELDS, coerceBoolean) ?? false);
      const nameValue = extractFromAny(script, NAME_FIELDS, value => (typeof value === 'string' ? value : undefined)) ?? `Script ${id}`;
      const lastRunTs = coerceNumber(script?.last_run ?? script?.last_execution ?? script?.last_exec_ts);

      return {
        id,
        name: nameValue,
        enabled,
        running,
        lastRunTs,
        raw: typeof script === 'object' && script !== null ? script : null,
      };
    });
}

function parseActions(result: any, filterIds?: Set<string>): ShellyActionState[] {
  const actions = Array.isArray(result?.actions) ? result.actions : [];

  return actions
    .filter((action: any) => {
      const id = action?.id ?? action?.name;
      if (!id) {
        return false;
      }
      const stringId = String(id);
      return !filterIds || filterIds.has(stringId);
    })
    .map((action: any) => {
      const id = String(action?.id ?? action?.name ?? '');
      const nameValue = extractFromAny(action, NAME_FIELDS, value => (typeof value === 'string' ? value : undefined)) ?? id;
      const enabled = extractFromAny(action, ENABLE_FIELDS, coerceBoolean);
      const group = extractFromAny(action, GROUP_FIELDS, value => (typeof value === 'string' ? value : undefined));

      return {
        id,
        name: nameValue,
        enabled,
        group,
        raw: typeof action === 'object' && action !== null ? action : null,
      };
    });
}

function parseSchedules(result: any, filterIds?: Set<number>): ShellyScheduleState[] {
  const schedules = Array.isArray(result?.schedules)
    ? result.schedules
    : Array.isArray(result?.jobs)
      ? result.jobs
      : [];

  return schedules
    .filter((schedule: any) => {
      const id = Number(schedule?.id);
      if (!Number.isFinite(id)) {
        return false;
      }
      return !filterIds || filterIds.has(id);
    })
    .map((schedule: any) => {
      const id = Number(schedule.id);
      const nameValue = extractFromAny(schedule, NAME_FIELDS, value => (typeof value === 'string' ? value : undefined)) ?? `Schedule ${id}`;
      const enabled = !!(extractFromAny(schedule, ENABLE_FIELDS, coerceBoolean) ?? false);
      const nextRunTs = extractFromAny(schedule, NEXT_RUN_FIELDS, coerceNumber);

      return {
        id,
        name: nameValue,
        enabled,
        nextRunTs,
        raw: typeof schedule === 'object' && schedule !== null ? schedule : null,
      };
    });
}

async function fetchControllerInfo(): Promise<ShellyControllerInfo | null> {
  try {
    const connection = resolveShellyConnectionOptions();
    const result = await callShelly('Shelly.GetDeviceInfo');
    if (!result || typeof result !== 'object') {
      return null;
    }

    const firmware = typeof result.fw_id === 'string' ? result.fw_id : typeof result.ver === 'string' ? result.ver : undefined;
    const uptimeSeconds = coerceNumber((result as any).uptime ?? (result as any).sys_uptime);

    return {
      name: typeof result.name === 'string' ? result.name : undefined,
      model: typeof result.model === 'string' ? result.model : undefined,
      firmware,
      mac: typeof result.mac === 'string' ? result.mac : undefined,
      uptimeSeconds,
      url: connection.host,
    };
  } catch (error) {
    if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
      throw error;
    }
    logger.warn('Shelly', 'Failed to fetch controller info', error);
    return null;
  }
}

export const fetchShellyData = async (config: ShellyWidgetConfig): Promise<ShellyWidgetData> => {
  const connection = resolveShellyConnectionOptions();
  let authError: string | null = null;

  const controllerPromise = fetchControllerInfo().catch((error) => {
    if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
      authError = 'Shelly controller rejected the configured credentials. Update SHELLY_USERNAME and SHELLY_PASSWORD secrets.';
      return null;
    }
    logger.warn('Shelly', 'Failed to fetch controller info', error);
    return null;
  });

  const thermostatConfigsPromise = loadThermostatConfigs(config).catch((error) => {
    if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
      authError = 'Shelly controller rejected the configured credentials. Update SHELLY_USERNAME and SHELLY_PASSWORD secrets.';
      return [] as ShellyThermostatConfig[];
    }
    logger.warn('Shelly', 'Failed to fetch thermostat list', error);
    return [] as ShellyThermostatConfig[];
  });

  const [controller, thermostatConfigs] = await Promise.all([controllerPromise, thermostatConfigsPromise]);

  const thermostatStates = await Promise.all(
    thermostatConfigs.map(async (thermo) => {
      try {
        const status = await callShelly('BluTrv.GetStatus', { id: thermo.id });
        return parseThermostatStatus(thermo.id, thermo.label, status);
      } catch (error) {
        if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
          authError = 'Shelly controller rejected the configured credentials. Update SHELLY_USERNAME and SHELLY_PASSWORD secrets.';
          logger.warn('Shelly', `Unauthorized while fetching thermostat ${thermo.id}`);
        } else if (error instanceof ShellyRpcError && error.code === 404) {
          logger.debug('Shelly', `BluTrv.GetStatus not supported - thermostat ${thermo.id} status unavailable`);
        } else {
          logger.error('Shelly', `Failed to fetch thermostat ${thermo.id}`, error);
        }
        return {
          id: thermo.id,
          label: thermo.label ?? thermo.id,
          status: 'unavailable',
          rawStatus: null,
        } satisfies ShellyThermostatState;
      }
    })
  );

  const scriptsPromise = (async () => {
    if (config?.includeScripts === false) {
      return [] as ShellyScriptState[];
    }
    try {
      const result = await callShelly('Script.List');
      const filterIds = config?.scriptIds?.length
        ? new Set(config.scriptIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
        : undefined;
      return parseScripts(result, filterIds);
    } catch (error) {
      if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
        authError = 'Shelly controller rejected the configured credentials. Update SHELLY_USERNAME and SHELLY_PASSWORD secrets.';
        return [] as ShellyScriptState[];
      }
      if (error instanceof ShellyRpcError && (error.status === 404 || error.code === 404)) {
        logger.info('Shelly', 'Shelly controller does not expose Script.List; skipping scripts');
        return [] as ShellyScriptState[];
      }
      logger.warn('Shelly', 'Failed to fetch scripts list', error);
      return [] as ShellyScriptState[];
    }
  })();

  const actionsPromise = (async () => {
    if (config?.includeActions === false) {
      return [] as ShellyActionState[];
    }
    try {
      const result = await callShelly('Actions.List');
      const filterIds = config?.actionIds?.length
        ? new Set(config.actionIds.map((id) => String(id)))
        : undefined;
      return parseActions(result, filterIds);
    } catch (error) {
      if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
        authError = 'Shelly controller rejected the configured credentials. Update SHELLY_USERNAME and SHELLY_PASSWORD secrets.';
        return [] as ShellyActionState[];
      }
      if (error instanceof ShellyRpcError && (error.status === 404 || error.code === 404)) {
        logger.info('Shelly', 'Shelly controller does not expose Actions.List; skipping actions');
        return [] as ShellyActionState[];
      }
      logger.warn('Shelly', 'Failed to fetch actions list', error);
      return [] as ShellyActionState[];
    }
  })();

  const schedulesPromise = (async () => {
    if (config?.includeSchedules === false) {
      return [] as ShellyScheduleState[];
    }
    try {
      const result = await callShelly('Schedule.List');
      const filterIds = config?.scheduleIds?.length
        ? new Set(config.scheduleIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))
        : undefined;
      return parseSchedules(result, filterIds);
    } catch (error) {
      if (error instanceof ShellyRpcError && (error.status === 401 || error.status === 403)) {
        authError = 'Shelly controller rejected the configured credentials. Update SHELLY_USERNAME and SHELLY_PASSWORD secrets.';
        return [] as ShellyScheduleState[];
      }
      if (error instanceof ShellyRpcError && (error.status === 404 || error.code === 404)) {
        logger.info('Shelly', 'Shelly controller does not expose Schedule.List; skipping schedules');
        return [] as ShellyScheduleState[];
      }
      logger.warn('Shelly', 'Failed to fetch schedules list', error);
      return [] as ShellyScheduleState[];
    }
  })();

  const [scripts, actions, schedules] = await Promise.all([scriptsPromise, actionsPromise, schedulesPromise]);

  return {
    controller,
    thermostats: thermostatStates,
    scripts,
    actions,
    schedules,
    controllerUrl: controller?.url ?? connection.host ?? null,
    authError,
  };
};
