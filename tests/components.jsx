// Test components for ctg-react-test self-tests

import { useState, useCallback } from "react";

// Simple greeting component — renders props to DOM
export function Greeting({ name }) {
    return <h1>Hello, {name}!</h1>;
}

// Counter component with stateful increment/decrement
export function Counter({ initial = 0 }) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const decrement = useCallback(() => setCount((c) => c - 1), []);
    return (
        <div>
            <span data-testid="count">{String(count)}</span>
            <button onClick={increment}>Increment</button>
            <button onClick={decrement}>Decrement</button>
        </div>
    );
}

// Form component with input, submission, and conditional rendering
export function LoginForm() {
    const [submitted, setSubmitted] = useState(false);
    const [username, setUsername] = useState("");
    return (
        <form role="form" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
            {submitted
                ? <p>Welcome, {username}!</p>
                : <>
                    <label htmlFor="user">Username</label>
                    <input
                        id="user"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <button type="submit">Submit</button>
                </>
            }
        </form>
    );
}

// Custom hook for renderHook testing
export function useCounter(initial = 0) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const reset = useCallback(() => setCount(initial), [initial]);
    return { count, increment, reset };
}
