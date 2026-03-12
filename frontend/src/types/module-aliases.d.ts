declare module "sonner@2.0.3" {
  export * from "sonner";
}

declare module "figma:asset/*.png" {
  const src: string;
  export default src;
}
