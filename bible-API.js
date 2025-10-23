// bible-API.js
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BibleAPIClass = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_JSON = 'https://raw.githubusercontent.com/christian-word/bible-engine/main/bible_ua.json';

  class BibleAPI {
    constructor(jsonUrl) {
      this.jsonUrl = jsonUrl || DEFAULT_JSON;
      this._loaded = false;
      this._books = []; // normalized books
      this._ready = this._load(); // Promise
    }

    // external: await bible.ready();
    ready() { return this._ready; }

    onReady(cb) {
      this._ready.then(() => cb()).catch(err => console.error(err));
    }

    async _load() {
      try {
        const res = await fetch(this.jsonUrl);
        if (!res.ok) throw new Error(`Failed to load JSON: ${res.status} ${res.statusText}`);
        const raw = await res.json();
        this._normalize(raw);
        this._loaded = true;
        console.info('Bible API: JSON loaded and normalized.');
      } catch (err) {
        console.error('Bible API load error:', err);
        throw err;
      }
    }

    // Normalizes various JSON shapes into:
    // this._books = [{ number: "1", shortName, name, chapters: [{ number: "1", verses: [{ number:"1", text:"..." , textLower:"..." }] }] }]
    _normalize(raw) {
      let booksRaw = raw;
      // common wrappers
      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw)) booksRaw = raw;
        else if (raw.body && Array.isArray(raw.body)) booksRaw = raw.body;
        else if (raw.books && Array.isArray(raw.books)) booksRaw = raw.books;
        else {
          // try to find an array inside
          for (const k of Object.keys(raw)) {
            if (Array.isArray(raw[k])) { booksRaw = raw[k]; break; }
          }
        }
      }

      this._books = (booksRaw || []).map((b, bi) => {
        const bookNumber = (b.number !== undefined) ? String(b.number) : String(bi + 1);
        const shortName = b.shortName || b.short || b.abbr || '';
        const name = b.name || b.title || b.book || `Book ${bookNumber}`;

        const chaptersRaw = Array.isArray(b.chapters) ? b.chapters : (Array.isArray(b.body) ? b.body : []);
        const chapters = (chaptersRaw || []).map((ch, ci) => {
          // ch may be { number, verses: [...] } OR an array of verses OR object with verses inside different key
          let versesArray = [];
          let chNumber = (ch && ch.number !== undefined) ? String(ch.number) : String(ci + 1);

          if (Array.isArray(ch)) {
            versesArray = ch;
          } else if (ch && Array.isArray(ch.verses)) {
            versesArray = ch.verses;
          } else if (ch && Array.isArray(ch.body)) {
            versesArray = ch.body;
          } else if (ch && typeof ch === 'object' && ch.verses === undefined) {
            // maybe chapter object with numbered keys
            const candidate = [];
            for (const k of Object.keys(ch)) {
              if (!isNaN(k)) candidate.push({ number: k, text: ch[k] });
            }
            if (candidate.length) versesArray = candidate;
          }

          // normalize verses
          const verses = (versesArray || []).map((v, vi) => {
            if (typeof v === 'string') {
              const text = v;
              return { number: String(vi + 1), text, textLower: text.toLowerCase() };
            } else if (v && typeof v === 'object') {
              // possible shapes: { number, text } OR {verse, text} OR {verseNumber, content}
              const number = (v.number || v.verseNumber || v.verse || v.v || v.id) !== undefined
                ? String(v.number || v.verseNumber || v.verse || v.v || v.id)
                : String(vi + 1);
              const text = (v.text || v.content || v.t || v.tr || v.line || '') ;
              const finalText = (text === '' && typeof v === 'object') ? (v[Object.keys(v).find(k => typeof v[k] === 'string' && k !== 'number')] || '') : text;
              const txt = String(finalText || '');
              return { number, text: txt, textLower: txt.toLowerCase() };
            } else {
              return { number: String(vi + 1), text: String(v || ''), textLower: String(v || '').toLowerCase() };
            }
          });

          return { number: chNumber, verses };
        });

        return { number: bookNumber, shortName, name, chapters };
      });
    }

    // utility to find book by number or name (case-insensitive)
    _findBook(bookIdentifier) {
      if (!bookIdentifier && bookIdentifier !== 0) return null;
      // numeric index or string number
      if (typeof bookIdentifier === 'number' || /^\d+$/.test(String(bookIdentifier))) {
        const num = Number(bookIdentifier);
        // prefer number field
        return this._books.find(b => Number(b.number) === num) || this._books[num - 1] || null;
      }
      const s = String(bookIdentifier).toLowerCase();
      return this._books.find(b => (b.name && b.name.toLowerCase() === s) || (b.shortName && b.shortName.toLowerCase() === s) || String(b.number) === s)
             || this._books.find(b => (b.name && b.name.toLowerCase().includes(s)) || (b.shortName && b.shortName.toLowerCase().includes(s))) || null;
    }

    // PUBLIC METHODS — all will wait for load if necessary
    async getBooks() {
      if (!this._loaded) await this._ready;
      return this._books.map(b => ({ number: b.number, shortName: b.shortName, name: b.name }));
    }

    async getChapters(bookIdentifier) {
      if (!this._loaded) await this._ready;
      const book = this._findBook(bookIdentifier);
      if (!book) return [];
      return book.chapters.map(ch => ch.number);
    }

    async getVerses(bookIdentifier, chapterIdentifier) {
      if (!this._loaded) await this._ready;
      const book = this._findBook(bookIdentifier);
      if (!book) return [];
      // chapterIdentifier can be number or string
      let chapter = null;
      if (typeof chapterIdentifier === 'number' || /^\d+$/.test(String(chapterIdentifier))) {
        const num = Number(chapterIdentifier);
        chapter = book.chapters.find(ch => Number(ch.number) === num) || book.chapters[num - 1] || null;
      } else {
        const s = String(chapterIdentifier).toLowerCase();
        chapter = book.chapters.find(ch => (ch.number && String(ch.number) === s) || String(ch.number) === s) || null;
      }
      return chapter ? chapter.verses.map(v => ({ number: v.number, text: v.text })) : [];
    }

    async getVerse(bookIdentifier, chapterIdentifier, verseIdentifier) {
      if (!this._loaded) await this._ready;
      const verses = await this.getVerses(bookIdentifier, chapterIdentifier);
      if (!verses.length) return null;
      if (typeof verseIdentifier === 'number' || /^\d+$/.test(String(verseIdentifier))) {
        const num = Number(verseIdentifier);
        return verses.find(v => Number(v.number) === num) || verses[num - 1] || null;
      }
      const s = String(verseIdentifier).toLowerCase();
      return verses.find(v => v.number === s) || null;
    }

    // selectionStr e.g. "1,3,5-7"
    async getVersesRange(bookIdentifier, chapterIdentifier, selectionStr) {
      if (!this._loaded) await this._ready;
      const verses = await this.getVerses(bookIdentifier, chapterIdentifier);
      if (!verses.length) return [];
      const parts = String(selectionStr || '').split(',').map(p => p.trim()).filter(Boolean);
      const nums = new Set();
      for (const p of parts) {
        if (p.includes('-')) {
          const [s, e] = p.split('-').map(x => parseInt(x, 10));
          if (isNaN(s) || isNaN(e)) continue;
          for (let i = s; i <= e; i++) nums.add(i);
        } else {
          const n = parseInt(p, 10);
          if (!isNaN(n)) nums.add(n);
        }
      }
      const sorted = Array.from(nums).sort((a,b)=>a-b);
      const out = [];
      for (const n of sorted) {
        const v = verses.find(x => Number(x.number) === n) || verses[n - 1];
        if (v) out.push(v);
      }
      return out;
    }

    // simple text search (case-insensitive)
    async search(query) {
      if (!this._loaded) await this._ready;
      if (!query) return [];
      const q = String(query).toLowerCase();
      const res = [];
      for (const b of this._books) {
        for (const ch of b.chapters) {
          for (const v of ch.verses) {
            if (v.textLower && v.textLower.includes(q)) {
              res.push({ book: b.name, chapter: ch.number, verse: v.number, text: v.text });
            } else if (!v.textLower && String(v.text).toLowerCase().includes(q)) {
              res.push({ book: b.name, chapter: ch.number, verse: v.number, text: v.text });
            }
          }
        }
      }
      return res;
    }

    // regex search: pattern can be RegExp or string
    async searchRegex(pattern) {
      if (!this._loaded) await this._ready;
      if (!pattern) return [];
      let regex;
      try {
        if (pattern instanceof RegExp) {
          // ensure global + unicode + insensitive
          const flags = (pattern.flags.indexOf('i') === -1 ? 'i' : '') + (pattern.flags.indexOf('u') === -1 ? 'u' : '') + 'g';
          regex = new RegExp(pattern.source, flags);
        } else {
          regex = new RegExp(String(pattern), 'giu');
        }
      } catch (e) {
        console.error('Invalid regex:', e);
        return [];
      }
      const res = [];
      for (const b of this._books) {
        for (const ch of b.chapters) {
          for (const v of ch.verses) {
            regex.lastIndex = 0;
            if (regex.test(v.text)) {
              res.push({ book: b.name, chapter: ch.number, verse: v.number, text: v.text });
            }
          }
        }
      }
      return res;
    }

    async getRandomVerse() {
      if (!this._loaded) await this._ready;
      if (!this._books.length) return null;
      const bIdx = Math.floor(Math.random() * this._books.length);
      const book = this._books[bIdx];
      if (!book.chapters.length) return null;
      const chIdx = Math.floor(Math.random() * book.chapters.length);
      const chapter = book.chapters[chIdx];
      if (!chapter.verses.length) return null;
      const vIdx = Math.floor(Math.random() * chapter.verses.length);
      const v = chapter.verses[vIdx];
      return { book: book.name, chapter: chapter.number, verse: v.number, text: v.text };
    }

    async getChapterText(bookIdentifier, chapterIdentifier) {
      const verses = await this.getVerses(bookIdentifier, chapterIdentifier);
      return verses.map(v => `${v.number}. ${v.text}`).join(' ');
    }

    async getAllVerses(bookIdentifier) {
      if (!this._loaded) await this._ready;
      const book = this._findBook(bookIdentifier);
      if (!book) return [];
      const all = [];
      for (const ch of book.chapters) {
        for (const v of ch.verses) {
          all.push({ chapter: ch.number, verse: v.number, text: v.text });
        }
      }
      return all;
    }
  }

  return BibleAPI;
});

// create browser-global instance for <script> usage:
if (typeof window !== 'undefined') {
  if (!window.BibleAPIClass) {
    console.warn('Bible API class not defined');
  } else {
    window.bible = new window.BibleAPIClass();
    // optional: expose promise property
    window.bible.ready().catch(()=>{/* ignore load error for now */});
  }
}

