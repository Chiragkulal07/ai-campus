import { useState, useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { API_URL } from './config';

// Assigns each node an (x, y) position based on its depth in the
// dependency graph (longest path from any root), so prerequisites
// always render to the left of what depends on them.
function computeLayout(nodes, edges) {
  const level = {};
  nodes.forEach((n) => { level[n.id] = 0; });
  for (let i = 0; i < nodes.length; i++) {
    edges.forEach((e) => {
      if (level[e.target] < level[e.source] + 1) level[e.target] = level[e.source] + 1;
    });
  }
  const columns = {};
  nodes.forEach((n) => {
    const lvl = level[n.id];
    if (!columns[lvl]) columns[lvl] = [];
    columns[lvl].push(n.id);
  });

  const xGap = 280, yGap = 130;
  const positions = {};
  Object.keys(columns).forEach((lvl) => {
    const ids = columns[lvl];
    ids.forEach((id, i) => {
      positions[id] = { x: Number(lvl) * xGap, y: i * yGap - ((ids.length - 1) * yGap) / 2 };
    });
  });
  return positions;
}

function RoadmapLab({ token, onExit }) {
  const [phase, setPhase] = useState('topic'); // topic | questions | loading | result | error
  const [topic, setTopic] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [resources, setResources] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setPhase('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/roadmap/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: topic.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed to start');
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(''));
      setPhase('questions');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const handleSubmitAnswers = async (e) => {
    e.preventDefault();
    setPhase('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/roadmap/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed to generate roadmap');
      setRoadmap(data.roadmap);
      setNodePositions({});
      setResources(data.resources || []);
      setPhase('result');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const flowNodes = useMemo(() => {
    if (!roadmap) return [];
    const layoutPositions = computeLayout(roadmap.nodes, roadmap.edges);
    return roadmap.nodes.map((n) => ({
      id: n.id,
      position: nodePositions[n.id] || layoutPositions[n.id] || { x: 0, y: 0 },
      data: { label: n.label },
      style: {
        background: selectedNodeId === n.id
          ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
          : 'linear-gradient(145deg, rgba(22,34,58,0.98), rgba(10,18,32,0.98))',
        color: '#f1f5f9',
        border: selectedNodeId === n.id ? '1px solid rgba(147,197,253,0.8)' : '1px solid rgba(148,163,184,0.2)',
        borderRadius: '9px',
        padding: '10px 14px',
        fontSize: '13px',
        fontWeight: 600,
        width: 220,
        boxShadow: selectedNodeId === n.id ? '0 8px 24px rgba(37,99,235,0.35)' : '0 8px 20px rgba(0,0,0,0.22)',
        transition: 'all 0.2s ease',
      }
    }));
  }, [roadmap, nodePositions, selectedNodeId]);

  const flowEdges = useMemo(() => {
    if (!roadmap) return [];
    return roadmap.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#3b82f6' }
    }));
  }, [roadmap]);

  const onNodeClick = useCallback((_, node) => setSelectedNodeId(node.id), []);
  const onNodesChange = useCallback((changes) => {
    setNodePositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          nextPositions[change.id] = change.position;
        }
      });
      return nextPositions;
    });
  }, []);

  const selectedNode = roadmap?.nodes.find((n) => n.id === selectedNodeId);
  const selectedResources = resources.find((r) => r.nodeId === selectedNodeId);

  const wrapStyle = {
    height: '100%', display: 'flex', flexDirection: 'column',
    background: 'radial-gradient(circle at 15% 0%, rgba(37,99,235,0.12), transparent 34%), #060a12',
    color: '#e2e8f0', padding: '28px clamp(18px, 3vw, 42px)', boxSizing: 'border-box'
  };

  const inputStyle = {
    padding: '13px 16px', borderRadius: '9px', border: '1px solid rgba(148,163,184,0.2)',
    background: 'rgba(15,23,42,0.72)', color: '#f1f5f9', fontSize: '14px', width: '100%',
    marginBottom: '14px', boxSizing: 'border-box', boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
  };

  const btnStyle = {
    padding: '10px 20px', borderRadius: '9px', border: '1px solid rgba(147,197,253,0.18)',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white',
    fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(37,99,235,0.2)'
  };

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', gap: '16px' }}>
        <div>
          <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 800, letterSpacing: '0.16em', marginBottom: '7px' }}>LEARNING STUDIO</div>
          <h2 style={{ margin: 0, fontSize: '22px', letterSpacing: '-0.02em' }}>🗺️ Roadmap Lab</h2>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '5px' }}>Turn a goal into a focused sequence of skills.</p>
        </div>
        <button onClick={onExit} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)' }}>Exit</button>
      </div>

      {phase === 'topic' && (
        <form onSubmit={handleStart} style={{ maxWidth: '480px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '16px' }}>What do you want to learn?</p>
          <input
            style={inputStyle}
            placeholder="e.g. Machine Learning, Web Development, Guitar"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button type="submit" style={btnStyle}>Start</button>
        </form>
      )}

      {phase === 'questions' && (
        <form onSubmit={handleSubmitAnswers} style={{ maxWidth: '560px' }}>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' }}>{q}</label>
              <input
                style={inputStyle}
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
              />
            </div>
          ))}
          <button type="submit" style={btnStyle}>Generate Roadmap</button>
        </form>
      )}

      {phase === 'loading' && <p style={{ color: '#94a3b8' }}>Generating your roadmap…</p>}

      {phase === 'error' && (
        <div>
          <p style={{ color: '#f87171' }}>{errorMsg}</p>
          <button onClick={() => setPhase('topic')} style={btnStyle}>Try Again</button>
        </div>
      )}

      {phase === 'result' && roadmap && (
        <div className="roadmap-result-layout" style={{ display: 'flex', flex: 1, gap: '20px', minHeight: 0, minWidth: 0 }}>
          <div className="roadmap-canvas-panel" style={{ flex: 2, minWidth: 0, minHeight: 360, border: '1px solid rgba(148,163,184,0.16)', borderRadius: '14px', overflow: 'hidden', background: 'rgba(8,14,25,0.82)', boxShadow: '0 18px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15,23,42,0.58)' }}>
              <div>
                <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 700 }}>Your learning path</div>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '3px' }}>Follow the sequence from foundations to practice.</div>
              </div>
              <div style={{ color: '#93c5fd', fontSize: '11px', fontWeight: 700, padding: '5px 9px', borderRadius: '999px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(96,165,250,0.18)' }}>
                {flowNodes.length} / {roadmap.nodes.length} steps
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                onNodeClick={onNodeClick}
                onNodesChange={onNodesChange}
                nodesDraggable
                fitView
                minZoom={0.1}
                maxZoom={2}
                fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 2 }}
                colorMode="dark"
              >
                <Background color="#334155" gap={16} />
                <Controls />
              </ReactFlow>
            </div>
          </div>

          <div className="roadmap-resource-panel" style={{ flex: 1, minWidth: 260, overflowY: 'auto', padding: '20px', border: '1px solid rgba(148,163,184,0.16)', borderRadius: '14px', background: 'rgba(15,23,42,0.52)', boxShadow: '0 18px 50px rgba(0,0,0,0.16)' }}>
            {!selectedNode && (
              <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '24px', color: '#64748b' }}>
                <div style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: '20px', marginBottom: '12px' }}>↗</div>
                <strong style={{ color: '#cbd5e1', fontSize: '13px' }}>Explore your roadmap</strong>
                <p style={{ fontSize: '12px', lineHeight: 1.5, marginTop: '5px' }}>Select a step to open its recommended resources.</p>
              </div>
            )}
            {selectedNode && (
              <div>
                <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', marginBottom: '8px' }}>SELECTED STEP</div>
                <h3 style={{ marginTop: 0, fontSize: '20px', lineHeight: 1.15 }}>{selectedNode.label}</h3>
                <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.55, marginTop: '9px' }}>{selectedNode.description}</p>

                {selectedResources?.youtube?.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '13px', color: '#60a5fa' }}>📺 Videos</h4>
                    {selectedResources.youtube.map((v, i) => (
                      <a key={i} href={v.url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '8px', textDecoration: 'none' }}>
                        • {v.title}
                      </a>
                    ))}
                  </>
                )}

                {selectedResources?.articles?.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '13px', color: '#60a5fa' }}>📄 Articles</h4>
                    {selectedResources.articles.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '8px', textDecoration: 'none' }}>
                        • {a.title}
                      </a>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoadmapLab;