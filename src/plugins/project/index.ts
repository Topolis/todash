import type { PluginDefinition } from '@types/plugin';
import ProjectStatusWidget from './widget';

export type { ProjectConfig, ProjectData } from './data';

export const projectPlugin: PluginDefinition<any, any> = {
  name: 'project-status',
  displayName: 'Project Status',
  description: 'Display project information from package.json and Git',
  widget: ProjectStatusWidget as any,
  serverSide: true,
  defaultRefreshInterval: 60,
  defaultConfig: {
    refreshSeconds: 60,
  },
};
