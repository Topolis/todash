// ABOUTME: Command line helper to verify Shelly controller RPC authentication.
// ABOUTME: Calls Shelly.GetDeviceInfo using configured secrets and reports the outcome.

import { resolveShellyConnectionOptions, callShelly, ShellyRpcError } from '../src/plugins/shelly/controller';

async function fetchList<T>(method: string, key: keyof T): Promise<T | null> {
  try {
    const result = await callShelly(method);
    if (result && Object.prototype.hasOwnProperty.call(result, key)) {
      return result as T;
    }
    return null;
  } catch (error) {
    if (error instanceof ShellyRpcError) {
      if (error.status === 404 || error.code === 404) {
        console.log(`\n${method} is not supported on this controller.`);
        return null;
      }
      if (error.status === 401 || error.status === 403) {
        console.log(`\n${method} is not accessible with the provided credentials (HTTP ${error.status}).`);
        return null;
      }
    }
    throw error;
  }
}

async function main() {
  try {
    const connection = resolveShellyConnectionOptions();

    if (!connection.host) {
      console.error('No Shelly host configured. Set SHELLY_HOST in secrets or environment.');
      process.exit(1);
    }

    console.log(`Testing Shelly credentials against ${connection.host}`);

    const info = await callShelly('Shelly.GetDeviceInfo');
    const name = typeof info?.name === 'string' ? info.name : 'Shelly Controller';
    console.log(`Success: authenticated as ${connection.username ?? 'anonymous'}. Controller name: ${name}`);

    const thermostats = await fetchList<{ thermostats: any[] }>('Thermostat.List', 'thermostats');
    if (thermostats?.thermostats?.length) {
      console.log('\nDetected thermostats:');
      for (const item of thermostats.thermostats) {
        const id = item?.id ?? item?.name ?? item?.mac ?? 'unknown';
        const label = item?.name ?? item?.label ?? item?.room ?? id;
        console.log(`  • ${label} (id: ${id})`);
      }
    }

    const scripts = await fetchList<{ scripts: any[] }>('Script.List', 'scripts');
    if (scripts?.scripts?.length) {
      console.log('\nDetected scripts:');
      for (const script of scripts.scripts) {
        const id = script?.id ?? 'unknown';
        const scriptName = script?.name ?? script?.label ?? `Script ${id}`;
        const enabled = script?.enable ?? script?.enabled;
        const running = script?.running ?? script?.active;
        console.log(`  • ${scriptName} (id: ${id}) enabled=${enabled} running=${running}`);
      }
    }

    const actions = await fetchList<{ actions: any[] }>('Actions.List', 'actions');
    if (actions?.actions?.length) {
      console.log('\nDetected actions:');
      for (const action of actions.actions) {
        const id = action?.id ?? action?.name ?? 'unknown';
        const actionName = action?.name ?? action?.label ?? id;
        console.log(`  • ${actionName} (id: ${id})`);
      }
    }

    const schedules = await fetchList<{ schedules?: any[]; jobs?: any[] }>('Schedule.List', 'schedules');
    const scheduleEntries = schedules?.schedules ?? schedules?.jobs ?? [];
    if (scheduleEntries.length) {
      console.log('\nDetected schedules:');
      for (const schedule of scheduleEntries) {
        const id = schedule?.id ?? 'unknown';
        const scheduleName = schedule?.name ?? schedule?.label ?? `Schedule ${id}`;
        const enabled = schedule?.enable ?? schedule?.enabled;
        console.log(`  • ${scheduleName} (id: ${id}) enabled=${enabled}`);
      }
    }

    process.exit(0);
  } catch (error) {
    if (error instanceof ShellyRpcError) {
      console.error(
        `Shelly RPC request failed.
  Method: ${error.method ?? 'unknown'}
  Status: ${error.status ?? 'n/a'}
  Message: ${error.message}`
      );
      if (error.status === 401 || error.status === 403) {
        console.error('The controller rejected the credentials. Double-check SHELLY_USERNAME and SHELLY_PASSWORD.');
      } else if (error.status === 404) {
        console.error('The controller does not support the requested RPC method on this firmware.');
      }
    } else if (error instanceof Error) {
      console.error(`Shelly RPC failed: ${error.message}`);
    } else {
      console.error('Shelly RPC failed with an unknown error');
    }
    process.exit(1);
  }
}

main();
