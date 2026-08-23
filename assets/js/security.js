/* ============================================================
   OopsMyPassword — client-side password security engine.
   100% local heuristics. No network. No storage. No logging.
   Exposed as window.OMPSecurity (and module.exports for tests).
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- Reference data ---------- */

  // A compact set of extremely common passwords (top of public breach corpuses).
  var COMMON_PASSWORDS = [
    '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234',
    '111111', '1234567', 'dragon', '123123', 'baseball', 'abc123', 'football',
    'monkey', 'letmein', 'shadow', 'master', '666666', 'qwertyuiop', '123321',
    'mustang', '1234567890', 'michael', '654321', 'superman', '1qaz2wsx',
    '7777777', '121212', '000000', 'qazwsx', '123qwe', 'killer', 'trustno1',
    'jordan', 'jennifer', 'zxcvbnm', 'asdfgh', 'hunter', 'buster', 'soccer',
    'harley', 'batman', 'andrew', 'tigger', 'sunshine', 'iloveyou', '2000',
    'charlie', 'robert', 'thomas', 'hockey', 'ranger', 'daniel', 'starwars',
    'klaster', '112233', 'george', 'computer', 'michelle', 'jessica', 'pepper',
    '1111', 'zxcvbn', '555555', '11111111', '131313', 'freedom', '777777',
    'pass', 'maggie', '159753', 'aaaaaa', 'ginger', 'princess', 'joshua',
    'cheese', 'amanda', 'summer', 'love', 'ashley', '6969', 'nicole', 'chelsea',
    'biteme', 'matthew', 'access', 'yankees', '987654321', 'dallas', 'austin',
    'thunder', 'taylor', 'matrix', 'minecraft', 'william', 'corvette', 'hello',
    'martin', 'heather', 'secret', 'fucker', 'merlin', 'diamond', '1234qwer',
    'gfhjkm', 'hammer', 'silver', '222222', '88888888', 'anthony', 'justin',
    'test', 'bailey', 'q1w2e3r4t5', 'patrick', 'internet', 'scooter', 'orange',
    '11111', 'golfer', 'cookie', 'richard', 'samantha', 'bigdog', 'guitar',
    'jackson', 'whatever', 'mickey', 'chicken', 'sparky', 'snoopy', 'maverick',
    'phoenix', 'camaro', 'sexy', 'peanut', 'morgan', 'welcome', 'falcon',
    'cowboy', 'ferrari', 'samsung', 'andrea', 'smokey', 'steelers', 'joseph',
    'mercedes', 'dakota', 'arsenal', 'eagles', 'melissa', 'boomer', 'booboo',
    'spider', 'nascar', 'monster', 'tigers', 'yellow', 'xxxxxx', '123123123',
    'gateway', 'marina', 'diablo', 'bulldog', 'qwer1234', 'compaq', 'purple',
    'hardcore', 'banana', 'junior', 'hannah', '123654', 'porsche', 'lakers',
    'iceman', 'money', 'cowboys', '987654', 'london', 'tennis', '999999',
    'ncc1701', 'coffee', 'scooby', 'miller', 'boston', 'q1w2e3', 'fuckyou',
    'brandon', 'yamaha', 'chester', 'mother', 'forever', 'johnny', 'edward',
    '333333', 'oliver', 'redsox', 'player', 'nikita', 'knight', 'fender',
    'barney', 'midnight', 'please', 'brandy', 'chicago', 'badboy', 'iwantu',
    'slayer', 'rangers', 'charles', 'angel', 'flower', 'bigdaddy', 'rabbit',
    'wizard', 'bigdick', 'jasper', 'enter', 'rachel', 'chris', 'steven',
    'winner', 'adidas', 'victoria', 'natasha', '1q2w3e4r', 'jasmine', 'winter',
    'prince', 'panties', 'marine', 'ghbdtn', 'fishing', 'cocacola', 'casper',
    'james', '232323', 'raiders', '888888', 'marlboro', 'gandalf', 'asdfasdf',
    'crystal', '87654321', '12344321', 'sexsex', 'golden', 'blowme', 'bigtits',
    '8675309', 'panther', 'lauren', 'angela', 'bitch', 'spanky', 'thx1138',
    'angels', 'madison', 'winston', 'shannon', 'mike', 'toyota', 'blowjob',
    'jordan23', 'canada', 'sophie', 'apples', 'march', 'tigers', 'dickhead',
    'abcd1234', 'poohbear', 'patrick', 'iloveu', 'passw0rd', 'pokemon',
    'qaz123', 'asdf1234', '1q2w3e', 'polpol', '9876543210', 'pass123',
    'admin', 'root', 'login', 'changeme', 'p@ssw0rd', 'password1', 'password12',
    'password123', 'qwerty123', 'qwerty1', 'hello123', 'abc12345', 'iloveyou1',
    'letmein1', 'welcome1', 'monkey123', 'dragon123', 'master123', 'football1',
    'baseball1', 'sunshine1', 'princess1', 'harley1', 'shadow1', 'superman1',
    'batman1', 'starwars1', 'trustno2', 'soccer1', 'hockey1', 'qazwsxedc',
    '1qazxsw2', 'zxcv1234', 'poiuyt', 'lkjhgf', 'mnbvcx', 'asdfghjkl',
    'qwertyuiop1', 'zaq12wsx', 'qazxsw', '159357', '741852963', '147258369',
    '102030', '11223344', '12121212', '12341234', '1234554321', '12345678910'
  ];

  // Common dictionary-style words frequently baked into passwords.
  var DICTIONARY_WORDS = [
    'password', 'passwort', 'welcome', 'admin', 'login', 'master', 'monkey',
    'dragon', 'football', 'baseball', 'soccer', 'hockey', 'shadow', 'sunshine',
    'princess', 'superman', 'batman', 'starwars', 'pokemon', 'hello', 'love',
    'iloveyou', 'secret', 'freedom', 'whatever', 'computer', 'internet',
    'summer', 'winter', 'spring', 'autumn', 'monday', 'sunday', 'january',
    'february', 'chicken', 'cheese', 'orange', 'purple', 'silver', 'golden',
    'matrix', 'angel', 'cookie', 'banana', 'coffee', 'rocket', 'flower',
    'hunter', 'killer', 'wizard', 'knight', 'tiger', 'bear', 'lion', 'eagle',
    'pirate', 'viking', 'castle', 'garden', 'house', 'family', 'school',
    'money', 'diamond', 'magic', 'music', 'guitar', 'happy', 'lucky', 'baby',
    'sweet', 'daddy', 'mommy', 'jupiter', 'mercury', 'victory', 'thunder',
    'lightning', 'storm', 'rainbow', 'butterfly', 'samsung', 'google',
    'apple', 'iphone', 'windows', 'marvel', 'disney', 'naruto', 'minecraft'
  ];

  // Keyboard walks (rows of common layouts, forward and reverse, length >= 4).
  var KEYBOARD_ROWS = [
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
    '1234567890', '1qaz2wsx3edc', 'qazwsx', 'qazwsxedc',
    'poiuytrewq', 'lkjhgfdsa', 'mnbvcxz', '0987654321'
  ];

  var LEET_MAP = {
    '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '9': 'g', '@': 'a', '$': 's', '!': 'i', '+': 't', '(': 'c', '|': 'l'
  };

  /* ---------- Helpers ---------- */

  function codePoints(s) { return Array.from(s); }

  function normalizeLeet(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      out += (LEET_MAP[ch] !== undefined) ? LEET_MAP[ch] : ch;
    }
    return out;
  }

  function log2(n) { return Math.log(n) / Math.LN2; }

  function round1(n) { return Math.round(n * 10) / 10; }

  /* ---------- Detection routines ---------- */

  function detectCategories(pw) {
    var cats = { lower: 0, upper: 0, digit: 0, symbol: 0 };
    codePoints(pw).forEach(function (ch) {
      if (/[a-z]/.test(ch)) cats.lower++;
      else if (/[A-Z]/.test(ch)) cats.upper++;
      else if (/[0-9]/.test(ch)) cats.digit++;
      else cats.symbol++;
    });
    cats.count = (cats.lower ? 1 : 0) + (cats.upper ? 1 : 0) + (cats.digit ? 1 : 0) + (cats.symbol ? 1 : 0);
    return cats;
  }

  function poolSize(cats) {
    var pool = 0;
    if (cats.lower) pool += 26;
    if (cats.upper) pool += 26;
    if (cats.digit) pool += 10;
    if (cats.symbol) pool += 33; // ~33 printable ASCII symbols
    return pool;
  }

  // Repeated runs like "aaaa", "1111" (3+ of same char)
  function findRepeats(pw) {
    var hits = [];
    var re = /(.)\1{2,}/g, m;
    while ((m = re.exec(pw)) !== null) hits.push(m[0]);
    return hits;
  }

  // Sequential runs (abc, cba, 123, 987...) length >= 3
  function findSequences(pw) {
    var hits = [];
    var chars = codePoints(pw);
    if (chars.length < 3) return hits;
    var run = [chars[0]];
    for (var i = 1; i < chars.length; i++) {
      var prev = chars[i - 1].codePointAt(0);
      var cur = chars[i].codePointAt(0);
      var diff = cur - prev;
      if (run.length < 2) {
        if (diff === 1 || diff === -1) run.push(chars[i]);
        else run = [chars[i]];
      } else {
        var firstDiff = run[1].codePointAt(0) - run[0].codePointAt(0);
        if (diff === firstDiff) run.push(chars[i]);
        else {
          if (run.length >= 3) hits.push(run.join(''));
          run = (diff === 1 || diff === -1) ? [chars[i - 1], chars[i]] : [chars[i]];
        }
      }
    }
    if (run.length >= 3) hits.push(run.join(''));
    return hits;
  }

  // Keyboard pattern walks
  function findKeyboardPatterns(pw) {
    var lower = pw.toLowerCase();
    var hits = [];
    KEYBOARD_ROWS.forEach(function (row) {
      for (var len = Math.min(6, row.length); len >= 4; len--) {
        for (var start = 0; start + len <= row.length; start++) {
          var pat = row.substring(start, start + len);
          if (lower.indexOf(pat) !== -1) {
            if (hits.indexOf(pat) === -1) hits.push(pat);
          }
        }
      }
    });
    return hits;
  }

  function findCommonSubstring(lowerPw) {
    var found = [];
    COMMON_PASSWORDS.forEach(function (w) {
      if (w.length >= 4 && lowerPw.indexOf(w) !== -1 && lowerPw !== w) found.push(w);
    });
    // longest first so callers can show the worst offender
    return found.sort(function (a, b) { return b.length - a.length; });
  }

  function findDictionaryWords(lowerPw) {
    var normalized = normalizeLeet(lowerPw);
    var found = [];
    DICTIONARY_WORDS.forEach(function (w) {
      if (w.length < 4) return;
      if (lowerPw.indexOf(w) !== -1 || normalized.indexOf(w) !== -1) {
        if (found.indexOf(w) === -1) found.push(w);
      }
    });
    return found;
  }

  function findDateLike(pw) {
    var hits = [];
    var re = /(19|20)\d{2}/g, m;
    while ((m = re.exec(pw)) !== null) hits.push(m[0]);
    return hits;
  }

  /* ---------- Passphrase detection (when the EFF wordlist is available) ---------- */

  function detectPassphrase(pw, wordlist) {
    var m = pw.match(/^([a-zA-Z]+(?:[-._ ]+[a-zA-Z]+){2,})(\d{1,4})?$/);
    if (!m) return null;
    var words = m[1].split(/[-._ ]+/);
    if (words.length < 3 || words.some(function (w) { return w.length < 3; })) return null;
    var info = { words: words.length, suffix: m[2] || null, recognized: false, inList: 0 };
    if (wordlist && wordlist.length) {
      var set = detectPassphrase._cache;
      if (!set || detectPassphrase._cacheSrc !== wordlist) {
        set = new Set(wordlist);
        detectPassphrase._cache = set;
        detectPassphrase._cacheSrc = wordlist;
      }
      words.forEach(function (w) { if (set.has(w.toLowerCase())) info.inList++; });
      info.listSize = wordlist.length;
      info.recognized = info.inList / words.length >= 0.75;
    }
    return info;
  }

  /* ---------- Scoring ---------- */

  var LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Excellent'];

  function tierOf(score) {
    if (score < 20) return 0;
    if (score < 40) return 1;
    if (score < 60) return 2;
    if (score < 80) return 3;
    return 4;
  }

  function analyzePassword(pw, opts) {
    opts = opts || {};
    if (typeof pw !== 'string') pw = '';
    var length = codePoints(pw).length;
    var empty = {
      score: 0, tier: -1, label: 'Enter a password', length: 0,
      entropy: 0, entropyNaive: 0, categories: detectCategories(''),
      poolSize: 0, crackTime: '—', crackSeconds: 0,
      findings: [], recommendations: [],
      entropyNote: 'pool-based, pattern-adjusted',
      flags: { isCommon: false, hasCommon: false, repeats: [], sequences: [], keyboard: [], dictionary: [], dates: [], passphrase: null }
    };
    if (length === 0) return empty;

    var lower = pw.toLowerCase();
    var cats = detectCategories(pw);
    var pool = poolSize(cats);

    /* --- detection --- */
    var isCommon = COMMON_PASSWORDS.indexOf(lower) !== -1;
    var commonSubs = isCommon ? [] : findCommonSubstring(lower);
    var repeats = findRepeats(pw);
    var sequences = findSequences(pw);
    var keyboard = findKeyboardPatterns(pw);
    var dictWords = findDictionaryWords(lower);
    var dates = findDateLike(pw);

    /* --- base score --- */
    var score = 0;
    score += Math.min(length, 25) * 1.6;              // up to 40
    score += cats.count * 10;                          // up to 40
    if (length >= 12) score += 4;
    if (length >= 16) score += 4;
    if (length >= 20) score += 4;
    if (cats.count === 4) score += 4;
    if (cats.symbol >= 2) score += 2;
    var first = pw.charAt(0);
    if (cats.upper > 0 && !/[A-Z]/.test(first)) score += 2; // uppercase beyond first char
    score = Math.min(score, 100);

    /* --- penalties --- */
    var penalties = 0;
    if (!isCommon && commonSubs.length) penalties += 30;
    if (repeats.length) penalties += Math.min(repeats.length * 8, 16);
    if (sequences.length) penalties += Math.min(sequences.length * 8, 16);
    if (keyboard.length) penalties += Math.min(keyboard.length * 12, 24);
    if (!isCommon && !commonSubs.length && dictWords.length) {
      // Whole-word passwords are not rescued by extra digits/symbols.
      penalties += Math.min(dictWords.length * 10, 20);
    }
    if (dates.length) penalties += 6;
    if (cats.count === 1 && /^\d+$/.test(pw)) penalties += 20;      // digits only
    if (cats.count === 1 && /^[a-z]+$/.test(pw) && length < 16) penalties += 10; // lowercase word-ish

    score = Math.round(Math.max(0, score - penalties));
    if (isCommon) score = Math.min(score, 12); // common passwords are never "ok"

    /* --- passphrase recognition (EFF wordlist-aware when bundled) --- */
    var pp = detectPassphrase(pw, opts.wordlist || null);
    if (pp && pp.recognized) {
      // A generated multi-word passphrase: treat the word structure as variety,
      // and never punish it for lacking symbols — words are the mechanism.
      var effCats = Math.min(4, 1 + Math.round(pp.words / 2));
      if (effCats > cats.count) score = Math.min(100, score + (effCats - cats.count) * 10);
    }
    score = Math.max(0, Math.min(100, score));

    /* --- entropy --- */
    var entropyNaive = pool > 0 ? length * log2(pool) : 0;
    var entropy;
    var entropyNote = 'pool-based, pattern-adjusted';
    if (pp && pp.recognized) {
      // Honest word-based entropy: words × log2(list size) + numeric suffix.
      entropy = pp.words * log2(pp.listSize);
      if (pp.suffix) entropy += pp.suffix.length * log2(10);
      entropyNote = 'word-based (' + pp.inList + '/' + pp.words + ' words in the ' + pp.listSize + '-word list)';
    } else {
      var factor = Math.max(0.2, Math.min(1, score / 100));
      entropy = entropyNaive * factor;
    }
    if (isCommon) entropy = Math.min(entropy, 15); // attackers try these first
    entropy = round1(entropy);
    entropyNaive = round1(entropyNaive);

    /* --- crack time (offline attack vs fast hash, ~1e11 guesses/s) --- */
    var guesses = Math.pow(2, Math.max(entropy - 1, 0));
    var crackSeconds = guesses / 1e11;
    var crackTime = formatDuration(crackSeconds);

    /* --- findings & recommendations --- */
    var flags = {
      isCommon: isCommon, hasCommon: commonSubs.length > 0,
      repeats: repeats, sequences: sequences, keyboard: keyboard,
      dictionary: dictWords, dates: dates, passphrase: pp
    };
    var findings = buildFindings(pw, length, cats, flags);
    if (pp && pp.recognized) {
      findings.push({ type: 'pass', text: 'Recognized as a ' + pp.words + '-word passphrase from a ' + pp.listSize.toLocaleString('en-US') + '-word list' });
    } else if (pp && !pp.recognized && opts.wordlist) {
      findings.push({ type: 'warn', text: 'Looks word-based; if you picked the words yourself, real-world entropy is far lower than any estimate' });
    }
    var recommendations = buildRecommendations(pw, length, cats, flags, score);

    return {
      score: score,
      tier: tierOf(score),
      label: LABELS[tierOf(score)],
      length: length,
      entropy: entropy,
      entropyNaive: entropyNaive,
      entropyNote: entropyNote,
      categories: cats,
      poolSize: pool,
      crackTime: crackTime,
      crackSeconds: crackSeconds,
      findings: findings,
      recommendations: recommendations,
      flags: flags
    };
  }

  function buildFindings(pw, length, cats, flags) {
    var out = [];
    out.push({
      type: length >= 16 ? 'pass' : length >= 12 ? 'info' : 'warn',
      text: length >= 16
        ? 'Strong length (' + length + ' characters)'
        : length >= 12
          ? 'Decent length (' + length + ' characters) — 16+ is better'
          : 'Short password (' + length + ' characters) — aim for 16+'
    });
    out.push({
      type: cats.count === 4 ? 'pass' : cats.count >= 3 ? 'info' : 'warn',
      text: cats.count === 4
        ? 'Uses all four character types'
        : 'Uses ' + cats.count + ' of 4 character types' +
          (!cats.upper ? ' (add uppercase)' : '') +
          (!cats.digit ? ' (add numbers)' : '') +
          (!cats.symbol ? ' (add symbols)' : '')
    });
    if (flags.isCommon) {
      out.push({ type: 'fail', text: 'This is one of the most common passwords in the world' });
    } else if (flags.hasCommon) {
      out.push({ type: 'fail', text: 'Contains a very common password inside it' });
    }
    if (flags.dates.length) {
      out.push({ type: 'warn', text: 'Contains what looks like a year — dates are heavily guessed' });
    }
    if (flags.repeats.length) {
      out.push({ type: 'warn', text: 'Repeated characters detected ("' + truncate(flags.repeats[0], 8) + '")' });
    }
    if (flags.sequences.length) {
      out.push({ type: 'warn', text: 'Sequential pattern detected ("' + truncate(flags.sequences[0], 8) + '")' });
    }
    if (flags.keyboard.length) {
      out.push({ type: 'warn', text: 'Keyboard walk detected ("' + truncate(flags.keyboard[0], 10) + '")' });
    }
    if (flags.dictionary.length && !flags.isCommon) {
      out.push({ type: 'warn', text: 'Contains dictionary-style word' + (flags.dictionary.length > 1 ? 's' : '') + ': ' + flags.dictionary.slice(0, 3).join(', ') });
    }
    if (!flags.isCommon && !flags.hasCommon && !flags.repeats.length &&
        !flags.sequences.length && !flags.keyboard.length) {
      out.push({ type: 'pass', text: 'No common passwords, repeats, sequences or keyboard walks found' });
    }
    return out;
  }

  function buildRecommendations(pw, length, cats, flags, score) {
    var out = [];
    if (flags.isCommon || flags.hasCommon) {
      out.push({ type: 'fail', text: 'Never use passwords found in breach dictionaries — change this one everywhere' });
    }
    out.push({
      type: length >= 12 ? 'pass' : 'warn',
      text: length >= 12 ? 'Good length (12+ characters)' : 'Use at least 12–16 characters'
    });
    out.push({
      type: cats.count >= 3 ? 'pass' : 'warn',
      text: cats.count >= 3 ? 'Uses multiple character types' : 'Mix uppercase, lowercase, numbers and symbols'
    });
    if (flags.repeats.length || flags.sequences.length || flags.keyboard.length) {
      out.push({ type: 'warn', text: 'Remove repeated characters, sequences and keyboard patterns' });
    }
    if (score < 80) {
      out.push({ type: 'warn', text: 'Prefer a memorable passphrase or a randomly generated password' });
    }
    out.push({ type: 'info', text: 'Avoid reusing this password on any other account' });
    out.push({ type: 'info', text: 'Consider storing it in a reputable password manager' });
    out.push({ type: 'info', text: 'Enable two-factor authentication wherever it is offered' });
    return out;
  }

  function truncate(s, n) {
    return s.length > n ? s.substring(0, n) + '…' : s;
  }

  /* ---------- Human durations ---------- */

  var UNIVERSE_SECONDS = 4.35e17; // ~13.8 billion years

  function formatDuration(seconds) {
    if (!isFinite(seconds) || seconds > UNIVERSE_SECONDS) return 'Longer than the age of the universe';
    if (seconds < 1) return 'Instantly';
    var units = [
      ['second', 1], ['minute', 60], ['hour', 3600],
      ['day', 86400], ['year', 31557600]
    ];
    if (seconds < 60) return fmt(seconds, 'second');
    var years = seconds / 31557600;
    if (years >= 1000) {
      if (years >= 1e9) return 'Billions of years';
      if (years >= 1e6) return 'Millions of years';
      if (years >= 1e3) return 'Thousands of years';
    }
    if (years >= 100) return 'Centuries';
    for (var i = units.length - 1; i >= 0; i--) {
      var v = seconds / units[i][1];
      if (v >= 1.5) return fmt(v, units[i][0]);
    }
    return fmt(seconds, 'second');
  }

  function fmt(v, unit) {
    var r = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return '~' + r.toLocaleString('en-US') + ' ' + unit + (r === 1 ? '' : 's');
  }

  /* ---------- Cryptographically secure generation ---------- */

  // Rejection sampling to eliminate modulo bias.
  function secureRandomInt(maxExclusive) {
    if (maxExclusive <= 0 || maxExclusive > 4294967296) throw new RangeError('max out of range');
    var cryptoObj = root.crypto || (root.msCrypto);
    if (!cryptoObj || !cryptoObj.getRandomValues) {
      throw new Error('crypto.getRandomValues() is not available in this browser.');
    }
    var range = 4294967296; // 2^32
    var limit = range - (range % maxExclusive);
    var buf = new Uint32Array(1);
    var x;
    do {
      cryptoObj.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % maxExclusive;
  }

  function secureShuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = secureRandomInt(i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  var SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?/~'
  };
  var AMBIGUOUS = 'Il1O0';

  function stripAmbiguous(s) {
    return s.split('').filter(function (c) { return AMBIGUOUS.indexOf(c) === -1; }).join('');
  }

  function generatePassword(opts) {
    opts = opts || {};
    var length = Math.max(4, Math.min(128, opts.length || 20));
    var useLower = opts.lower !== false;
    var useUpper = opts.upper !== false;
    var useDigits = opts.digits !== false;
    var useSymbols = opts.symbols !== false;
    var pools = [];
    if (useLower) pools.push(opts.excludeAmbiguous ? stripAmbiguous(SETS.lower) : SETS.lower);
    if (useUpper) pools.push(opts.excludeAmbiguous ? stripAmbiguous(SETS.upper) : SETS.upper);
    if (useDigits) pools.push(opts.excludeAmbiguous ? stripAmbiguous(SETS.digits) : SETS.digits);
    if (useSymbols) {
      var sym = opts.symbolSet || SETS.symbols;
      pools.push(opts.excludeAmbiguous ? stripAmbiguous(sym) : sym);
    }
    if (!pools.length) throw new Error('Select at least one character type.');
    if (length < pools.length) length = pools.length;

    var combined = pools.join('');
    var chars = [];
    // Guarantee at least one character from every selected pool,
    // then fill the rest uniformly, then shuffle — all via CSPRNG.
    pools.forEach(function (pool) {
      chars.push(pool.charAt(secureRandomInt(pool.length)));
    });
    while (chars.length < length) {
      chars.push(combined.charAt(secureRandomInt(combined.length)));
    }
    return secureShuffle(chars).join('');
  }

  function pickWords(list, count) {
    var out = [];
    for (var i = 0; i < count; i++) out.push(list[secureRandomInt(list.length)]);
    return out;
  }

  /* ---------- API ---------- */

  var api = {
    analyzePassword: analyzePassword,
    detectCategories: detectCategories,
    poolSize: poolSize,
    formatDuration: formatDuration,
    secureRandomInt: secureRandomInt,
    secureShuffle: secureShuffle,
    generatePassword: generatePassword,
    pickWords: pickWords,
    LABELS: LABELS,
    COMMON_PASSWORDS: COMMON_PASSWORDS,
    UNIVERSE_SECONDS: UNIVERSE_SECONDS,
    version: '1.0.0'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OMPSecurity = api;
})(typeof window !== 'undefined' ? window : globalThis);
