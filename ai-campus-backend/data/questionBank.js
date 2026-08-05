// A small hand-written question bank, used until Phase 4 wires up real AI generation.
// Each question needs exactly 4 options and a correctIndex (0-3).
const questionBank = [
  {
    questionText: 'What does "npm" stand for?',
    options: ['Node Package Manager', 'New Programming Method', 'Network Protocol Module', 'Node Process Monitor'],
    correctIndex: 0
  },
  {
    questionText: 'Which HTTP method is typically used to update existing data?',
    options: ['GET', 'PUT', 'DELETE', 'CONNECT'],
    correctIndex: 1
  },
  {
    questionText: 'In JavaScript, what does "===" check that "==" does not?',
    options: ['Nothing, they are identical', 'Type, in addition to value', 'Only value, not type', 'Whether a variable exists'],
    correctIndex: 1
  },
  {
    questionText: 'What is the time complexity of binary search on a sorted array?',
    options: ['O(n)', 'O(n^2)', 'O(log n)', 'O(1)'],
    correctIndex: 2
  },
  {
    questionText: 'Which of these is NOT a valid MongoDB data type?',
    options: ['ObjectId', 'String', 'Float', 'Boolean'],
    correctIndex: 2
  },
  {
    questionText: 'What does SQL "JOIN" do?',
    options: ['Deletes duplicate rows', 'Combines rows from two or more tables', 'Sorts a table', 'Creates a new database'],
    correctIndex: 1
  },
  {
    questionText: 'In React, what hook is used to run code after a component renders?',
    options: ['useState', 'useEffect', 'useMemo', 'useRef'],
    correctIndex: 1
  },
  {
    questionText: 'What does "CORS" primarily control?',
    options: ['Database speed', 'Which websites can call your API from a browser', 'CSS styling rules', 'Password encryption'],
    correctIndex: 1
  }
];

module.exports = questionBank;