import mkcert from 'vite-plugin-mkcert'

export default {
  base: './',
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js'
      }
    }
  },
  plugins: [
    mkcert()
  ]
}
