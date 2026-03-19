export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
    console.log("[instrumentation] 나라장터 스케줄러 시작됨");
  }
}
