import api from "./api";

export const loginUser = (username: string, password: string) => {
  return api.post("/auth/login", { username, password });
};

const safeRemoveStorageItem = (storage: Storage | undefined, key: string) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage access failures during logout cleanup.
  }
};

export const logout = () => {
  safeRemoveStorageItem(typeof localStorage !== "undefined" ? localStorage : undefined, "token");
  safeRemoveStorageItem(typeof localStorage !== "undefined" ? localStorage : undefined, "user");
  safeRemoveStorageItem(typeof sessionStorage !== "undefined" ? sessionStorage : undefined, "auth401_notified");
};
