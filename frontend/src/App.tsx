import { Calculator } from './components/Calculator'
import './App.css'

function App() {
  return (
    <main className="app">
      <h1>Calculator</h1>
      <Calculator />
      <p className="hint">
        Keyboard: digits, <kbd>+ − * / ^ %</kbd>, <kbd>r</kbd> for √, <kbd>n</kbd> for ±, <kbd>Enter</kbd>,{' '}
        <kbd>Backspace</kbd>, <kbd>Esc</kbd>. “% of” computes <em>a</em>% of <em>b</em>.
      </p>
    </main>
  )
}

export default App
