import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './pages/App'
import { attachAuthInterceptor } from './utils/authedFetch'
import 'antd/dist/reset.css'

attachAuthInterceptor()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


