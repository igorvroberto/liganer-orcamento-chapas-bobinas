import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy em vendas.liganer.com.br/orcamento/chapas-bobinas/
export default defineConfig({
  plugins: [react()],
  base: '/orcamento/chapas-bobinas/',
  server: {
    // Em dev, a planilha compartilhada vive no host de produção.
    proxy: {
      '/orcamento/tabelas': {
        target: 'https://vendas.liganer.com.br',
        changeOrigin: true,
      },
    },
  },
})
