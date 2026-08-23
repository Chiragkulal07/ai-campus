const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    { id: 'CODING_LAB', name: 'Coding Lab', description: 'DSA, SQL, MCQ and code challenges', mapConfig: { x: 400, y: 300, color: '#188c88' } },
    { id: 'INTERVIEW_HALL', name: 'Interview Hall', description: 'Mock interviews and resume review', mapConfig: { x: 800, y: 300, color: '#5c4535' } },
    { id: 'LIBRARY', name: 'Library', description: 'Document Q&A and research challenges', mapConfig: { x: 400, y: 700, color: '#b08154' } },
    { id: 'EVENT_HALL', name: 'Event Hall', description: 'Hackathons and community events', mapConfig: { x: 800, y: 700, color: '#de9b2a' } }
  ]);
});

module.exports = router;
