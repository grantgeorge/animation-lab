import type { AnimationLabHook } from "@/ui/store/testHook";

declare global {
  interface Window {
    __animationLab?: AnimationLabHook;
  }
}

export {};
