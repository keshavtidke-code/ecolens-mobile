const secureStoreAdapter = {
  getItem: async (key: string) => {
    if (process.env.EXPO_OS === "web") {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
    }
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string) => {
    if (process.env.EXPO_OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  removeItem: async (key: string) => {
    if (process.env.EXPO_OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
