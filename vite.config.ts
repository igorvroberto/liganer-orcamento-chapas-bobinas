import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy em vendas.liganer.com.br/bobinas-chapas/ (mesmo padrão de /blanks e /prospeccao)
export default defineConfig({
  plugins: [react()],
  base: '/bobinas-chapas/',
})
