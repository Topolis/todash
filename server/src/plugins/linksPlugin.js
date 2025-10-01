export const linksPlugin = {
  async fetchData(config) {
    // Links widget doesn't need server-side data fetching
    // It just displays static links from the configuration
    return config || {};
  },
};
