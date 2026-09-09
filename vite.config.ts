import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy em vendas.liganer.com.br/orcamento/chapas-bobinas/
export default defineConfig({
  plugins: [react()],
  base: '/orcamento/chapas-bobinas/',
})
