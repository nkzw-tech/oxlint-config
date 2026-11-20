import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // The integration suite installs packages. Run it separately with `pnpm test:vite-plus`.
  test: { exclude: [...configDefaults.exclude, 'integration/**'] },
});
