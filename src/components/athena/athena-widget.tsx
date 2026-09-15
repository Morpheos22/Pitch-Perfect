'use client';

import { useState } from 'react';

export function AthenaWidget() {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      const response = await fetch('/api/athena', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
      const payload = await response.json();
      setAnswer(payload.message || payload.error || 'Athena did not return a response.');
    } finally { setLoading(false); }
  };
  return <section aria-label="Athena agent"><form onSubmit={submit}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask Athena about your pitch, product, repo, or market..." /><button type="submit" disabled={loading}>{loading ? 'Thinking…' : 'Ask Athena'}</button></form>{answer && <p>{answer}</p>}</section>;
}

export default AthenaWidget;
