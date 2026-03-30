
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'figma:asset/db669b4bced4ab8156f89804329b6fa6850dcefe.png': path.resolve(__dirname, './src/assets/db669b4bced4ab8156f89804329b6fa6850dcefe.png'),
        'figma:asset/ce4dfc0cf5a830f92c2fd62dc6c96df085c26dbc.png': path.resolve(__dirname, './src/assets/ce4dfc0cf5a830f92c2fd62dc6c96df085c26dbc.png'),
        'figma:asset/a8f5701e9577d83dbd168ba49abfcac0ee1f67ed.png': path.resolve(__dirname, './src/assets/a8f5701e9577d83dbd168ba49abfcac0ee1f67ed.png'),
        'figma:asset/99a5eba53eba8837d0cb541ba62cda8ccbc4a805.png': path.resolve(__dirname, './src/assets/99a5eba53eba8837d0cb541ba62cda8ccbc4a805.png'),
        'figma:asset/8a215f70fe30661dded39794b547f89ef79421a3.png': path.resolve(__dirname, './src/assets/8a215f70fe30661dded39794b547f89ef79421a3.png'),
        'figma:asset/8a0ed739a579876c65a0f2da973edea7761374d3.png': path.resolve(__dirname, './src/assets/8a0ed739a579876c65a0f2da973edea7761374d3.png'),
        'figma:asset/7321848448cd8ebca7be3ef98338b1ef5a797e72.png': path.resolve(__dirname, './src/assets/7321848448cd8ebca7be3ef98338b1ef5a797e72.png'),
        'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png': path.resolve(__dirname, './src/assets/661f558dc14c79fa090b7039a885f26b843f5c04.png'),
        'figma:asset/5b64391ff4dcf4882ababb9ee4a6a5ced73c1dba.png': path.resolve(__dirname, './src/assets/5b64391ff4dcf4882ababb9ee4a6a5ced73c1dba.png'),
        'figma:asset/58af19785453a99273d5a0b2ab1d8cd3bef38814.png': path.resolve(__dirname, './src/assets/58af19785453a99273d5a0b2ab1d8cd3bef38814.png'),
        'figma:asset/461e1ff0ab4e49689ca66e52e50dea826af8f838.png': path.resolve(__dirname, './src/assets/461e1ff0ab4e49689ca66e52e50dea826af8f838.png'),
        'figma:asset/4378c0337b9408d92957475ac5b944bfbac86cd1.png': path.resolve(__dirname, './src/assets/4378c0337b9408d92957475ac5b944bfbac86cd1.png'),
        'figma:asset/21b78da43754d46e875d60c203750b3009892612.png': path.resolve(__dirname, './src/assets/21b78da43754d46e875d60c203750b3009892612.png'),
        'figma:asset/1f1743d2ca74edce5a1b10a6510625bb91ae936b.png': path.resolve(__dirname, './src/assets/1f1743d2ca74edce5a1b10a6510625bb91ae936b.png'),
        'figma:asset/1b31dc690fa09272d3ffca6b134fdfa5a13785f4.png': path.resolve(__dirname, './src/assets/1b31dc690fa09272d3ffca6b134fdfa5a13785f4.png'),
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'docx@9.0.1': 'docx',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('recharts')) {
              return 'charts-vendor';
            }

            if (
              id.includes('docx') ||
              id.includes('xlsx') ||
              id.includes('file-saver')
            ) {
              return 'office-vendor';
            }

            if (id.includes('motion')) {
              return 'motion-vendor';
            }

            if (
              id.includes('@radix-ui') ||
              id.includes('cmdk') ||
              id.includes('vaul') ||
              id.includes('embla-carousel') ||
              id.includes('react-day-picker') ||
              id.includes('input-otp') ||
              id.includes('react-hook-form') ||
              id.includes('react-resizable-panels')
            ) {
              return 'ui-vendor';
            }

            return 'vendor';
          },
        },
      },
    },
    server: {
      port: 3000,
      open: true,
    },
  });
