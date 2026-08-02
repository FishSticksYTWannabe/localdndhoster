import { useEffect, useState } from 'react';

interface Book {
  id: string;
  title: string;
  content: string;
}

const electron = (window as any).require?.('electron');
const ipcRenderer = electron?.ipcRenderer;

function BooksPanel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [aiEndpoint, setAiEndpoint] = useState('');

  useEffect(() => {
    (async () => {
      if (!ipcRenderer) return;
      const res = await ipcRenderer.invoke('books:load');
      if (res?.success) setBooks(res.books || []);
    })();
  }, []);

  const saveBooks = async (next: Book[]) => {
    setBooks(next);
    if (!ipcRenderer) return;
    await ipcRenderer.invoke('books:save', next);
  };

  const addBook = () => {
    if (!title.trim()) return;
    const book: Book = { id: `${Date.now()}`, title, content };
    saveBooks([book, ...books]);
    setTitle('');
    setContent('');
  };

  const removeBook = (id: string) => {
    saveBooks(books.filter((b) => b.id !== id));
  };

  const generateAbility = async () => {
    if (!ipcRenderer) return;
    const prompt = `Create a D&D ability based on: ${content || title}`;
    const res = await ipcRenderer.invoke('ai:generate', { prompt, endpoint: aiEndpoint || undefined });
    if (res?.success) {
      const result = res.result;
      const generatedText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const book: Book = { id: `${Date.now()}`, title: `${title || 'Generated Ability'}`, content: generatedText };
      saveBooks([book, ...books]);
    }
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card">
          <h2>Books / Compendium</h2>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Content
            <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          <label>
            Local AI endpoint (optional)
            <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} placeholder="http://localhost:8080/generate" />
          </label>
          <div className="button-row">
            <button onClick={addBook}>Add Book</button>
            <button onClick={generateAbility}>Generate Ability (AI)</button>
          </div>
        </div>

        <div className="panel-card">
          <h2>Saved Books</h2>
          {books.length === 0 ? (
            <div className="small-text">No books yet.</div>
          ) : (
            books.map((b) => (
              <div key={b.id} className="book-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{b.title}</strong>
                  <button onClick={() => removeBook(b.id)}>Delete</button>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{b.content}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default BooksPanel;
