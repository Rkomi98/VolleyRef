// Deterministic mock generator for VolleyRef — no backend, replace with real API later.
(function () {
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  function simulateSet(finalA, finalB, firstServer, rng) {
    const score = { A: 0, B: 0 };
    let server = firstServer;
    let turnStart = { A: 0, B: 0 };
    let turnPoints = 0;
    const target = { A: finalA, B: finalB };
    const turns = [];
    let guard = 0;
    while ((score.A !== finalA || score.B !== finalB) && guard < 400) {
      guard++;
      const candidates = ['A', 'B'].filter((t) => score[t] < target[t]);
      const winner = candidates.length === 1 ? candidates[0] : candidates[Math.floor(rng() * candidates.length)];
      if (winner === server) {
        score[winner]++; turnPoints++;
      } else {
        turns.push({ team: server, points: turnPoints, start: { ...turnStart }, end: { ...score } });
        server = winner;
        score[winner]++;
        turnStart = { ...score }; turnStart[winner] -= 1;
        turnPoints = 1;
      }
    }
    turns.push({ team: server, points: turnPoints, start: turnStart, end: { ...score } });
    return turns;
  }

  function buildSet(setNumber, teamAKey, teamBKey, lineups, finalA, finalB, firstServer, rng, opts) {
    opts = opts || {};
    const rawTurns = simulateSet(finalA, finalB, firstServer, rng);
    const counters = { A: 0, B: 0 };
    const teamKeyOf = { A: teamAKey, B: teamBKey };
    const rows = rawTurns.map((t, i) => {
      counters[t.team]++;
      const n = counters[t.team];
      const offset = t.team === firstServer ? 0 : 5;
      const idx = (n - 1 + offset) % 6;
      const teamKey = teamKeyOf[t.team];
      return {
        id: `s${setNumber}-t${i + 1}`,
        index: i + 1,
        teamKey,
        teamSide: t.team,
        server: lineups[teamKey][idx],
        rotationIndex: idx,
        rotation: ROMAN[idx],
        start: `${t.start.A}\u2013${t.start.B}`,
        end: `${t.end.A}\u2013${t.end.B}`,
        points: t.points,
        confidence: 'high',
        edited: false,
        status: 'validated',
      };
    });
    (opts.lowConfidenceTurnIndexes || []).forEach((i) => { if (rows[i]) { rows[i].confidence = 'low'; rows[i].status = 'review'; } });
    (opts.editedTurnIndexes || []).forEach((i) => { if (rows[i]) { rows[i].edited = true; } });
    if (opts.corruptLastEnd && rows.length) {
      // deliberately introduce an inconsistency: last turn end doesn't match final score
      const last = rows[rows.length - 1];
      const parts = last.end.split('\u2013').map(Number);
      if (last.teamSide === 'A') parts[0] -= 1; else parts[1] -= 1;
      last.end = `${parts[0]}\u2013${parts[1]}`;
    }

    const lineupConfidence = {
      [teamAKey]: [0, 0, 0, 0, 0, 0].map(() => 'high'),
      [teamBKey]: [0, 0, 0, 0, 0, 0].map(() => 'high'),
    };
    const lineupEdited = {
      [teamAKey]: [false, false, false, false, false, false],
      [teamBKey]: [false, false, false, false, false, false],
    };
    (opts.lowConfidenceLineup || []).forEach(([teamKey, posIdx]) => { lineupConfidence[teamKey][posIdx] = 'low'; });
    (opts.editedLineup || []).forEach(([teamKey, posIdx]) => { lineupEdited[teamKey][posIdx] = true; });

    let checks = [
      { id: 'score', label: 'Punteggio finale coerente', status: 'success' },
      { id: 'rotation', label: 'Ordine delle rotazioni coerente', status: 'success' },
      { id: 'sequence', label: 'Sequenza dei servizi coerente', status: 'success' },
      { id: 'lineup', label: 'Sestetto iniziale completo', status: 'success' },
    ];
    const lowCount = Object.values(lineupConfidence).flat().filter((c) => c === 'low').length +
      rows.filter((r) => r.confidence === 'low').length;
    if (lowCount > 0) {
      checks.push({ id: 'confidence', label: `${lowCount} valori con confidence ridotta`, status: 'warning' });
    } else {
      checks.push({ id: 'confidence', label: 'Tutti i valori con confidence alta', status: 'success' });
    }
    if (opts.corruptLastEnd) {
      checks = checks.map((c) => c.id === 'score' ? { ...c, status: 'error', label: 'Punteggio finale non coerente con i turni di servizio' } : c);
    }
    if (opts.sequenceWarning) {
      checks = checks.map((c) => c.id === 'sequence' ? { ...c, status: 'warning', label: 'Sequenza dei servizi da confermare su un turno' } : c);
    }

    let status = 'validated';
    if (checks.some((c) => c.status === 'error')) status = 'inconsistent';
    else if (checks.some((c) => c.status === 'warning')) status = 'review';

    return {
      number: setNumber, teamAKey, teamBKey, scoreA: finalA, scoreB: finalB,
      firstServe: firstServer === 'A' ? teamAKey : teamBKey,
      lineups: { [teamAKey]: lineups[teamAKey].slice(), [teamBKey]: lineups[teamBKey].slice() },
      lineupConfidence, lineupEdited,
      serviceTurns: rows, checks, status,
    };
  }

  function buildMatch(id, opts) {
    const rng = mulberry32(opts.seed);
    const sets = opts.sets.map((s, i) => buildSet(i + 1, opts.teamAKey, opts.teamBKey, opts.lineups, s.a, s.b, s.first, rng, s.opts));
    const setsWonA = sets.filter((s) => s.scoreA > s.scoreB).length;
    const setsWonB = sets.length - setsWonA;
    let status = 'validated';
    if (sets.some((s) => s.status === 'inconsistent')) status = 'inconsistent';
    else if (sets.some((s) => s.status === 'review')) status = 'review';
    return {
      id, competition: opts.competition, date: opts.date, venue: opts.venue,
      teamA: { key: opts.teamAKey, name: opts.teamAName, short: opts.teamAShort },
      teamB: { key: opts.teamBKey, name: opts.teamBName, short: opts.teamBShort },
      finalScore: { a: setsWonA, b: setsWonB },
      status, sets,
    };
  }

  const cerea = buildMatch('cerea-rothoblaas', {
    seed: 42,
    competition: 'Serie B — Girone C', date: '14 apr 2026', venue: 'PalaCerea, Cerea (VR)',
    teamAKey: 'cerea', teamAName: 'ISUZU CEREA VR', teamAShort: 'Cerea',
    teamBKey: 'rothoblaas', teamBName: 'ROTHOBLAAS VOLANO TN', teamBShort: 'Rothoblaas',
    lineups: { cerea: [2, 5, 3, 8, 14, 9], rothoblaas: [14, 9, 3, 4, 15, 17] },
    sets: [
      { a: 25, b: 27, first: 'A', opts: {} },
      { a: 19, b: 25, first: 'B', opts: {} },
      { a: 25, b: 23, first: 'A', opts: {} },
      { a: 24, b: 26, first: 'B', opts: { lowConfidenceLineup: [['rothoblaas', 2]], lowConfidenceTurnIndexes: [6] } },
    ],
  });

  const sanmarco = buildMatch('sanmarco-vicenza', {
    seed: 7,
    competition: 'Serie C — Girone A', date: '3 mag 2026', venue: 'Palasport Comunale, San Marco',
    teamAKey: 'sanmarco', teamAName: 'PALLAVOLO SAN MARCO', teamAShort: 'San Marco',
    teamBKey: 'vicenza', teamBName: 'NUOVA EDIL VICENZA', teamBShort: 'Vicenza',
    lineups: { sanmarco: [7, 11, 4, 9, 2, 15], vicenza: [3, 18, 8, 12, 5, 21] },
    sets: [
      { a: 25, b: 19, first: 'A', opts: {} },
      { a: 23, b: 25, first: 'B', opts: { corruptLastEnd: true, sequenceWarning: true } },
      { a: 25, b: 22, first: 'A', opts: {} },
      { a: 20, b: 25, first: 'B', opts: { lowConfidenceLineup: [['sanmarco', 3], ['vicenza', 1]], lowConfidenceTurnIndexes: [2, 9], editedTurnIndexes: [4] } },
      { a: 15, b: 12, first: 'A', opts: {} },
    ],
  });

  window.VR_MOCK = { matches: { [cerea.id]: cerea, [sanmarco.id]: sanmarco }, matchList: [cerea, sanmarco] };
})();
