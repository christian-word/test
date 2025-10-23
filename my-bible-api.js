// my-bible-api.js — Независимый API для Библии (на основе твоей структуры)
class MyBibleAPI {
  constructor(jsonUrl) {
    this.jsonUrl = jsonUrl || 'https://raw.githubusercontent.com/christian-word/test/refs/heads/main/bible_ua.json';
    this._loaded = false;
    this._books = []; // нормализованные книги
    this._ready = this._load(); // Promise для загрузки
  }

  // Ждать загрузки
  async ready() {
    return this._ready;
  }

  async _load() {
    try {
      const res = await fetch(this.jsonUrl);
      if (!res.ok) throw new Error(`Ошибка загрузки JSON: ${res.status} ${res.statusText}`);
      const raw = await res.json();
      this._normalize(raw);
      this._loaded = true;
      console.info('MyBibleAPI: JSON загружен и нормализован.');
    } catch (err) {
      console.error('Ошибка загрузки MyBibleAPI:', err);
      throw err;
    }
  }

  // Нормализация данных в структуру: books = [{ number, shortName, name, chapters: [{ number, verses: [{ number, text, textLower }] }] }]
  _normalize(raw) {
    let booksRaw = Array.isArray(raw) ? raw : (raw.books || raw.body || []);
    this._books = booksRaw.map((b, bi) => {
      const number = String(b.number || bi + 1);
      const shortName = b.shortName || b.abbr || '';
      const name = b.name || `Книга ${number}`;
      const chapters = (Array.isArray(b.chapters) ? b.chapters : []).map((ch, ci) => {
        const chNumber = String(ch.number || ci + 1);
        const verses = (Array.isArray(ch.verses) ? ch.verses : []).map((v, vi) => {
          const vNumber = String(v.number || vi + 1);
          const text = String(v.text || '');
          return { number: vNumber, text, textLower: text.toLowerCase() };
        });
        return { number: chNumber, verses };
      });
      return { number, shortName, name, chapters };
    });
  }

  // Поиск книги по номеру или имени
  _findBook(identifier) {
    if (!identifier) return null;
    const s = String(identifier).toLowerCase();
    return this._books.find(b => b.number === s || b.name.toLowerCase() === s || b.shortName.toLowerCase() === s) ||
           this._books.find(b => b.name.toLowerCase().includes(s) || b.shortName.toLowerCase().includes(s)) || null;
  }

  async getBooks() {
    if (!this._loaded) await this._ready;
    return this._books.map(b => ({ number: b.number, shortName: b.shortName, name: b.name }));
  }

  async getChapters(bookId) {
    if (!this._loaded) await this._ready;
    const book = this._findBook(bookId);
    return book ? book.chapters.map(ch => ch.number) : [];
  }

  async getVerses(bookId, chapterId) {
    if (!this._loaded) await this._ready;
    const book = this._findBook(bookId);
    if (!book) return [];
    const chapter = book.chapters.find(ch => ch.number === String(chapterId)) || null;
    return chapter ? chapter.verses.map(v => ({ number: v.number, text: v.text })) : [];
  }

  async getVerse(bookId, chapterId, verseId) {
    const verses = await this.getVerses(bookId, chapterId);
    return verses.find(v => v.number === String(verseId)) || null;
  }

  async getVersesRange(bookId, chapterId, rangeStr) {
    const verses = await this.getVerses(bookId, chapterId);
    const parts = String(rangeStr).split(',').map(p => p.trim());
    const nums = new Set();
    parts.forEach(p => {
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(Number);
        for (let i = start; i <= end; i++) nums.add(i);
      } else {
        nums.add(Number(p));
      }
    });
    return Array.from(nums).sort((a, b) => a - b).map(n => verses.find(v => Number(v.number) === n)).filter(Boolean);
  }

  async search(query) {
    if (!this._loaded) await this._ready;
    const q = String(query).toLowerCase();
    const results = [];
    this._books.forEach(book => {
      book.chapters.forEach(ch => {
        ch.verses.forEach(v => {
          if (v.textLower.includes(q)) {
            results.push({ book: book.name, chapter: ch.number, verse: v.number, text: v.text });
          }
        });
      });
    });
    return results;
  }

  async searchRegex(pattern) {
    if (!this._loaded) await this._ready;
    let regex;
    try {
      regex = new RegExp(pattern, 'giu');
    } catch (e) {
      console.error('Неверный regex:', e);
      return [];
    }
    const results = [];
    this._books.forEach(book => {
      book.chapters.forEach(ch => {
        ch.verses.forEach(v => {
          regex.lastIndex = 0;
          if (regex.test(v.text)) {
            results.push({ book: book.name, chapter: ch.number, verse: v.number, text: v.text });
          }
        });
      });
    });
    return results;
  }

  async getRandomVerse() {
    if (!this._loaded) await this._ready;
    const book = this._books[Math.floor(Math.random() * this._books.length)];
    const ch = book.chapters[Math.floor(Math.random() * book.chapters.length)];
    const v = ch.verses[Math.floor(Math.random() * ch.verses.length)];
    return { book: book.name, chapter: ch.number, verse: v.number, text: v.text };
  }
}

// Глобальный экземпляр для страницы

const myBible = new MyBibleAPI();
