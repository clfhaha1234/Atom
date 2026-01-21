import React, { useState } from 'react';

export default function App() {
  const [display, setDisplay] = useState('0');
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  const handleNumber = (num: string) => {
    if (waitingForSecondOperand) {
      setDisplay(num);
      setWaitingForSecondOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleDecimal = () => {
    if (waitingForSecondOperand) {
      setDisplay('0.');
      setWaitingForSecondOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const calculate = (first: number, second: number, op: string): number => {
    switch (op) {
      case '+': return first + second;
      case '-': return first - second;
      case '×': return first * second;
      case '÷': return first / second;
      default: return second;
    }
  };

  const handleOperator = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator) {
      const result = calculate(firstOperand, inputValue, operator);
      setDisplay(String(result));
      setFirstOperand(result);
    }

    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
  };

  const handleEqual = () => {
    if (operator === null || firstOperand === null) return;
    const result = calculate(firstOperand, parseFloat(display), operator);
    setDisplay(String(result));
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  const handleClear = () => {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '320px', margin: '0 auto' }}>
      <h1>Calculator</h1>
      <div style={{ 
        border: '1px solid #ccc', 
        padding: '10px', 
        marginBottom: '10px',
        fontSize: '24px',
        textAlign: 'right',
        minHeight: '40px',
        backgroundColor: '#fff'
      }}>
        {display}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <button onClick={() => handleNumber('7')}>7</button>
        <button onClick={() => handleNumber('8')}>8</button>
        <button onClick={() => handleNumber('9')}>9</button>
        <button onClick={() => handleOperator('÷')} style={{ backgroundColor: '#f9a825' }}>÷</button>
        
        <button onClick={() => handleNumber('4')}>4</button>
        <button onClick={() => handleNumber('5')}>5</button>
        <button onClick={() => handleNumber('6')}>6</button>
        <button onClick={() => handleOperator('×')} style={{ backgroundColor: '#f9a825' }}>×</button>
        
        <button onClick={() => handleNumber('1')}>1</button>
        <button onClick={() => handleNumber('2')}>2</button>
        <button onClick={() => handleNumber('3')}>3</button>
        <button onClick={() => handleOperator('-')} style={{ backgroundColor: '#f9a825' }}>-</button>
        
        <button onClick={() => handleNumber('0')}>0</button>
        <button onClick={handleDecimal}>.</button>
        <button onClick={handleClear}>C</button>
        <button onClick={() => handleOperator('+')} style={{ backgroundColor: '#f9a825' }}>+</button>
        
        <button 
          onClick={handleEqual} 
          style={{ gridColumn: 'span 4', backgroundColor: '#4CAF50', color: 'white' }}
        >=</button>
      </div>
    </div>
  );
}