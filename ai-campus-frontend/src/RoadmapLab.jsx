import { useState, useCallback, useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, useNodesState, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './roadmap.css';
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

  const xGap = 350, yGap = 160;
  const positions = {};
  Object.keys(columns).forEach((lvl) => {
    const ids = columns[lvl];
    ids.forEach((id, i) => {
      positions[id] = { x: Number(lvl) * xGap, y: i * yGap - ((ids.length - 1) * yGap) / 2 };
    });
  });
  return positions;
}

// Computes completed vs current vs locked visual hierarchy based on
// graph dependencies and the currently selected node.
function computeNodeStatuses(nodes, edges, selectedNodeId) {
  const level = {};
  nodes.forEach((n) => { level[n.id] = 0; });
  for (let i = 0; i < nodes.length; i++) {
    edges.forEach((e) => {
      if (level[e.target] < level[e.source] + 1) {
        level[e.target] = level[e.source] + 1;
      }
    });
  }

  // If nothing is selected yet, starting nodes (level 0) are 'current', deeper ones 'locked'
  if (!selectedNodeId) {
    const statuses = {};
    nodes.forEach((n) => {
      statuses[n.id] = level[n.id] === 0 ? 'current' : 'locked';
    });
    return { statuses, level };
  }

  // Find all upstream ancestors of selectedNodeId (backward BFS)
  const ancestors = new Set();
  const bwdQueue = [selectedNodeId];
  while (bwdQueue.length > 0) {
    const curr = bwdQueue.shift();
    edges.forEach((e) => {
      if (e.target === curr && !ancestors.has(e.source)) {
        ancestors.add(e.source);
        bwdQueue.push(e.source);
      }
    });
  }

  // Find all downstream descendants of selectedNodeId (forward BFS)
  const descendants = new Set();
  const fwdQueue = [selectedNodeId];
  while (fwdQueue.length > 0) {
    const curr = fwdQueue.shift();
    edges.forEach((e) => {
      if (e.source === curr && !descendants.has(e.target)) {
        descendants.add(e.target);
        fwdQueue.push(e.target);
      }
    });
  }

  const selectedLevel = level[selectedNodeId] ?? 0;
  const statuses = {};

  nodes.forEach((n) => {
    if (n.id === selectedNodeId) {
      statuses[n.id] = 'current';
    } else if (ancestors.has(n.id) || level[n.id] < selectedLevel) {
      statuses[n.id] = 'completed';
    } else if (descendants.has(n.id) || level[n.id] > selectedLevel) {
      statuses[n.id] = 'locked';
    } else {
      statuses[n.id] = 'available';
    }
  });

  return { statuses, level };
}

function getCleanDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'resource';
  }
}

// Custom larger, legible Roadmap Node with visual hierarchy
function RoadmapNode({ data }) {
  const { label, description, stepNumber, status = 'locked', isSelected } = data;
  const isCurrent = status === 'current' || isSelected;

  return (
    <div className={`roadmap-node-card status-${status} ${isCurrent ? 'is-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="node-custom-handle"
      />

      <div className="node-meta-row">
        <span className="node-step-label">
          {stepNumber != null ? `STEP ${String(stepNumber).padStart(2, '0')}` : 'STEP'}
        </span>
        <div className="node-status-badge">
          {status === 'completed' && (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Done</span>
            </>
          )}
          {status === 'current' && (
            <>
              <span className="pulse-indicator-dot" />
              <span>Current</span>
            </>
          )}
          {status === 'locked' && (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Upcoming</span>
            </>
          )}
          {status === 'available' && (
            <span>○ Ready</span>
          )}
        </div>
      </div>

      <h4 className="node-card-title">{label}</h4>

      {description && (
        <p className="node-card-desc">{description}</p>
      )}

      {isCurrent && (
        <div className="node-active-bar" />
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="node-custom-handle"
      />
    </div>
  );
}

const nodeTypes = {
  roadmapNode: RoadmapNode,
  default: RoadmapNode,
};

// Cycles through friendly status messages while the LLM/resource fetch is
// running, so the loading screen feels alive instead of a static spinner.
const LOADING_MESSAGES_QUESTIONS = [
  'Reading your topic…',
  'Thinking of good follow-up questions…',
  'Almost ready…'
];
const LOADING_MESSAGES_ROADMAP = [
  'Designing your learning path…',
  'Ordering topics from beginner to advanced…',
  'Lining up videos and articles…',
  'Putting the final touches on your roadmap…'
];

function InteractiveLoader({ messages }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '340px', gap: '22px'
    }}>
      <div style={{ position: 'relative', width: '56px', height: '56px' }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid rgba(59,130,246,0.15)', borderTopColor: '#3b82f6',
          boxShadow: '0 0 18px rgba(59,130,246,0.3)',
          animation: 'roadmap-spin 0.9s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite'
        }} />
        <div style={{
          position: 'absolute', inset: '8px', borderRadius: '50%',
          border: '2px solid rgba(96,165,250,0.1)', borderBottomColor: '#60a5fa',
          animation: 'roadmap-spin 1.4s linear infinite reverse'
        }} />
      </div>
      <p style={{
        color: '#93c5fd', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em',
        transition: 'opacity 0.3s ease', minHeight: '22px', textAlign: 'center', margin: 0
      }}>
        {messages[index]}
      </p>
      <div style={{ display: 'flex', gap: '7px' }}>
        {messages.map((_, i) => (
          <div key={i} style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: i === index ? '#60a5fa' : 'rgba(148,163,184,0.22)',
            boxShadow: i === index ? '0 0 8px #3b82f6' : 'none',
            transition: 'all 0.3s ease'
          }} />
        ))}
      </div>
      <style>{`
        @keyframes roadmap-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function RoadmapLab({ token, onExit }) {
  const [phase, setPhase] = useState('topic'); // topic | questions | loading | result | error
  const [loadingKind, setLoadingKind] = useState('questions'); // 'questions' | 'roadmap'
  const [topic, setTopic] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [resources, setResources] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoadingKind('questions');
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
    setLoadingKind('roadmap');
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
      const positions = computeLayout(data.roadmap.nodes, data.roadmap.edges);
      setNodes(data.roadmap.nodes.map((node) => ({
        id: node.id,
        position: positions[node.id] || { x: 0, y: 0 },
        data: { label: node.label }
      })));
      setResources(data.resources || []);
      setPhase('result');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  // Poll for resources after the roadmap is shown — they're generated in the
  // background on the server and arrive a few seconds after the initial response.
  useEffect(() => {
    if (phase !== 'result' || !sessionId) return;
    if (resources.length > 0) return; // already have them, stop polling

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // ~45s total at 3s intervals, then give up

    const poll = async () => {
      if (cancelled || attempts >= maxAttempts) return;
      attempts += 1;
      try {
        const res = await fetch(`${API_URL}/roadmap/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!cancelled && data.resources && data.resources.length > 0) {
          setResources(data.resources);
          return; // stop polling, we got them
        }
      } catch (err) {
        console.error('resource poll failed:', err.message);
      }
      if (!cancelled) setTimeout(poll, 3000);
    };

    const timer = setTimeout(poll, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, sessionId, resources.length, token]);

  const nodeStatusInfo = useMemo(() => {
    if (!roadmap?.nodes || !roadmap?.edges) return { statuses: {}, level: {} };
    return computeNodeStatuses(roadmap.nodes, roadmap.edges, selectedNodeId);
  }, [roadmap, selectedNodeId]);

  const flowNodes = useMemo(() => {
    return nodes.map((node, idx) => {
      const fullNode = roadmap?.nodes.find((n) => n.id === node.id);
      const isSelected = selectedNodeId === node.id;
      const status = nodeStatusInfo.statuses[node.id] || (isSelected ? 'current' : 'locked');

      return {
        ...node,
        type: 'roadmapNode',
        data: {
          label: node.data?.label || fullNode?.label || node.id,
          description: fullNode?.description || '',
          stepNumber: idx + 1,
          status,
          isSelected,
        },
      };
    });
  }, [nodes, selectedNodeId, roadmap, nodeStatusInfo]);

  const flowEdges = useMemo(() => {
    if (!roadmap) return [];
    return roadmap.edges.map((e, i) => {
      const sourceStatus = nodeStatusInfo.statuses[e.source];
      const targetStatus = nodeStatusInfo.statuses[e.target];
      const isCompleted = sourceStatus === 'completed' && (targetStatus === 'completed' || targetStatus === 'current');
      const isCurrentOut = sourceStatus === 'current';
      const isLocked = sourceStatus === 'locked';

      let stroke = '#3b82f6';
      let strokeWidth = 2;
      let strokeDasharray = undefined;
      let animated = true;

      if (isCompleted) {
        stroke = '#10b981';
        strokeWidth = 2.5;
      } else if (isCurrentOut) {
        stroke = '#60a5fa';
        strokeWidth = 2.5;
      } else if (isLocked) {
        stroke = 'rgba(148, 163, 184, 0.28)';
        strokeWidth = 1.5;
        strokeDasharray = '5 5';
        animated = false;
      }

      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated,
        style: {
          stroke,
          strokeWidth,
          strokeDasharray,
          filter: animated ? `drop-shadow(0 0 5px ${stroke}88)` : 'none',
          transition: 'stroke 0.3s ease, filter 0.3s ease',
        }
      };
    });
  }, [roadmap, nodeStatusInfo]);

  const onNodeClick = useCallback((_, node) => setSelectedNodeId(node.id), []);

  const selectedNode = roadmap?.nodes.find((n) => n.id === selectedNodeId);
  const selectedResources = resources.find((r) => r.nodeId === selectedNodeId);
  const selectedStepIndex = roadmap?.nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNodeStatus = selectedNodeId ? (nodeStatusInfo.statuses[selectedNodeId] || 'current') : null;

  return (
    <div className={`roadmap-container ${phase === 'result' ? 'phase-result' : 'phase-form'}`}>
      {/* Topbar Header */}
      <div className="roadmap-topbar">
        <div className="roadmap-topbar-left">
          <div className="roadmap-eyebrow">
            <span className="roadmap-eyebrow-dot" />
            LEARNING STUDIO
          </div>
          <h2 className="roadmap-header-title">🗺️ Roadmap Lab</h2>
          <p className="roadmap-header-subtitle">
            {roadmap ? (
              <>
                Personalized curriculum for <span className="roadmap-topic-highlight">"{topic}"</span>
              </>
            ) : (
              'Turn any goal into an actionable, step-by-step masterclass.'
            )}
          </p>
        </div>
        <button onClick={onExit} className="roadmap-exit-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Exit Lab
        </button>
      </div>

      {/* Phase 1: Topic Input */}
      {phase === 'topic' && (
        <div className="roadmap-form-scroll-container">
          <form onSubmit={handleStart} className="roadmap-form-card">
            <div className="roadmap-form-header-badge">
              <span>✨</span>
              <span>AI Curriculum Architect</span>
            </div>
            <h3 className="roadmap-form-title">What do you want to learn?</h3>
            <p className="roadmap-form-desc">
              Enter a subject, programming language, creative craft, or career milestone to build your pathway.
            </p>
            <div className="roadmap-chips-row">
              {['Machine Learning', 'Full-Stack Web Dev', 'System Design', 'UI/UX Design', 'Data Engineering'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="roadmap-chip-btn"
                  onClick={() => setTopic(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <input
              className="roadmap-input-field"
              placeholder="e.g. Machine Learning, Web Development, Guitar"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button type="submit" className="roadmap-primary-btn">
              <span>Generate Questions</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Phase 2: Questions */}
      {phase === 'questions' && (
        <div className="roadmap-form-scroll-container">
          <form onSubmit={handleSubmitAnswers} className="roadmap-form-card" style={{ maxWidth: '580px' }}>
            <div className="roadmap-form-header-badge">
              <span>🎯</span>
              <span>Tailor Your Experience</span>
            </div>
            <h3 className="roadmap-form-title">Fine-tune your roadmap</h3>
            <p className="roadmap-form-desc">
              Answer a few quick questions so we can calibrate prerequisites and pace for "{topic}".
            </p>
            {questions.map((q, i) => (
              <div key={i} className="roadmap-question-card">
                <label className="roadmap-question-label">
                  <span className="roadmap-question-idx">{i + 1}</span>
                  <span>{q}</span>
                </label>
                <input
                  className="roadmap-input-field"
                  placeholder="Type your answer or experience level…"
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                />
              </div>
            ))}
            <button type="submit" className="roadmap-primary-btn">
              <span>Build My Roadmap</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Phase 3: Loading */}
      {phase === 'loading' && (
        <InteractiveLoader
          messages={loadingKind === 'questions' ? LOADING_MESSAGES_QUESTIONS : LOADING_MESSAGES_ROADMAP}
        />
      )}

      {/* Phase 4: Error */}
      {phase === 'error' && (
        <div className="roadmap-form-scroll-container">
          <div className="roadmap-error-card">
            <p className="roadmap-error-text">⚠️ {errorMsg}</p>
            <button onClick={() => setPhase('topic')} className="roadmap-primary-btn">
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Phase 5: Result - Two-Panel Layout */}
      {phase === 'result' && roadmap && (
        <div className="roadmap-result-layout">
          {/* Left Panel: React Flow Interactive Graph */}
          <div className="roadmap-canvas-panel">
            <div className="roadmap-canvas-header">
              <div className="canvas-header-title-wrap">
                <div className="canvas-header-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </div>
                <div>
                  <div className="canvas-header-title">Curriculum Path</div>
                  <div className="canvas-header-sub">Dependencies flow left to right • Select any milestone to inspect</div>
                </div>
              </div>

              <div className="canvas-header-legend">
                <div className="legend-item">
                  <span className="legend-dot dot-completed" />
                  <span>Done</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-current" />
                  <span>Current</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-locked" />
                  <span>Upcoming</span>
                </div>
                <div className="canvas-step-badge">
                  {flowNodes.length} Milestones
                </div>
              </div>
            </div>

            <div className="roadmap-flow-wrapper">
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                onNodesChange={onNodesChange}
                nodesDraggable
                fitView
                minZoom={0.1}
                maxZoom={2}
                fitViewOptions={{ padding: 0.25, minZoom: 0.1, maxZoom: 2 }}
                colorMode="dark"
              >
                <Background color="rgba(59, 130, 246, 0.1)" gap={24} size={1.5} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </div>

          {/* Right Panel: Selected-Step Details & Rich Clickable Cards */}
          <div className="roadmap-resource-panel">
            {!selectedNode && (
              <div className="empty-selection-view">
                <div className="empty-icon-glow">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                  </svg>
                </div>
                <h3>Select a Milestone</h3>
                <p>Click any step in the roadmap graph to explore its learning goals, video tutorials, and technical guides.</p>
                <div className="empty-hint-pill">
                  <span>💡</span>
                  <span>Interactive Pathway Navigator</span>
                </div>
              </div>
            )}

            {selectedNode && (
              <div key={selectedNode.id} className="selected-node-container step-details-animated">
                {/* Step Header */}
                <div className="node-detail-header">
                  <div className="node-detail-tag-row">
                    <span className={`status-pill pill-${selectedNodeStatus}`}>
                      {selectedNodeStatus === 'completed' && '✓ COMPLETED'}
                      {selectedNodeStatus === 'current' && '● IN PROGRESS'}
                      {selectedNodeStatus === 'locked' && '🔒 UPCOMING'}
                      {selectedNodeStatus === 'available' && '○ READY'}
                    </span>
                    <span className="step-count-pill">
                      STEP {String((selectedStepIndex != null && selectedStepIndex >= 0 ? selectedStepIndex + 1 : 1)).padStart(2, '0')} OF {roadmap.nodes.length}
                    </span>
                  </div>
                  <h3 className="node-detail-title">{selectedNode.label}</h3>
                  {selectedNode.description && (
                    <div className="node-detail-desc-box">
                      <p className="node-detail-desc">{selectedNode.description}</p>
                    </div>
                  )}
                </div>

                <div className="resource-divider" />

                {/* Curated Resources Section */}
                <div className="resources-section">
                  {!selectedResources?.youtube?.length && !selectedResources?.articles?.length ? (
                    <div className="resources-loading-state">
                      <div className="resources-loading-badge">
                        <span className="resource-spin-dot" />
                        <span>Curating recommended tutorials & articles…</span>
                      </div>
                      <div className="skeleton-card shimmer" />
                      <div className="skeleton-card shimmer" />
                    </div>
                  ) : (
                    <>
                      {/* Video Tutorials */}
                      {selectedResources?.youtube?.length > 0 && (
                        <div className="resource-group">
                          <div className="resource-group-header">
                            <div className="group-title-row">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" fill="#ef4444" />
                              </svg>
                              <h4>Video Lessons</h4>
                            </div>
                            <span className="group-count-badge">
                              {selectedResources.youtube.length} {selectedResources.youtube.length === 1 ? 'lesson' : 'lessons'}
                            </span>
                          </div>
                          <div className="resource-cards-list">
                            {selectedResources.youtube.map((v, i) => (
                              <a
                                key={i}
                                href={v.url}
                                target="_blank"
                                rel="noreferrer"
                                className="resource-card resource-card-video"
                              >
                                <div className="resource-card-icon-wrap video-icon">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                                  </svg>
                                </div>
                                <div className="resource-card-content">
                                  <div className="resource-card-meta">
                                    <span className="resource-tag video-tag">YOUTUBE</span>
                                    <span className="resource-domain">youtube.com</span>
                                  </div>
                                  <div className="resource-card-title">{v.title}</div>
                                </div>
                                <div className="resource-card-arrow">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="7" y1="17" x2="17" y2="7"></line>
                                    <polyline points="7 7 17 7 17 17"></polyline>
                                  </svg>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Technical Articles & Guides */}
                      {selectedResources?.articles?.length > 0 && (
                        <div className="resource-group">
                          <div className="resource-group-header">
                            <div className="group-title-row">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                              </svg>
                              <h4>Articles &amp; Guides</h4>
                            </div>
                            <span className="group-count-badge">
                              {selectedResources.articles.length} {selectedResources.articles.length === 1 ? 'article' : 'articles'}
                            </span>
                          </div>
                          <div className="resource-cards-list">
                            {selectedResources.articles.map((a, i) => (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="resource-card resource-card-article"
                              >
                                <div className="resource-card-icon-wrap article-icon">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                  </svg>
                                </div>
                                <div className="resource-card-content">
                                  <div className="resource-card-meta">
                                    <span className="resource-tag article-tag">GUIDE</span>
                                    <span className="resource-domain">{getCleanDomain(a.url)}</span>
                                  </div>
                                  <div className="resource-card-title">{a.title}</div>
                                </div>
                                <div className="resource-card-arrow">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="7" y1="17" x2="17" y2="7"></line>
                                    <polyline points="7 7 17 7 17 17"></polyline>
                                  </svg>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="resource-bottom-spacer" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoadmapLab;