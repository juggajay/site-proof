export function runScript(main: () => Promise<void>, cleanup?: () => Promise<void>): void {
  void main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    })
    .finally(async () => {
      await cleanup?.();
    });
}
