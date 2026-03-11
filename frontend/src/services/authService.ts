import api from "./api";

export const loginUser = (username: string, password: string) => {
  return api.post("/auth/login", { username, password });
};
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};