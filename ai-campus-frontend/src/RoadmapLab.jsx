import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ReactFlow, Background, Panel, useNodesState, useReactFlow, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './roadmap.css';
import { API_URL } from './config';
import { readJson } from './utils';

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

  const xGap = 280, yGap = 150;
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
  const { label, description, stepNumber, status = 'locked', isSelected, level = 0 } = data;
  const isCurrent = status === 'current' || isSelected;

  return (
    <div
      className={`roadmap-node-card status-${status} ${isCurrent ? 'is-selected' : ''}`}
      style={{ '--enter-delay': `${120 + level * 110}ms` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="node-custom-handle"
      />

      <div className="node-meta-row">
        <span className="node-step-label">
          {stepNumber != null ? String(stepNumber).padStart(2, '0') : '—'}
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
            <span>Ready</span>
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

function RoadmapCanvasControls({ selectedNodeId }) {
  const { getNode, getZoom, setCenter, fitView } = useReactFlow();

  const zoomAroundSelected = (direction) => {
    const node = selectedNodeId ? getNode(selectedNodeId) : null;
    if (!node) {
      fitView({ duration: 400, padding: 0.1 });
      return;
    }

    const width = node.measured?.width || 230;
    const height = node.measured?.height || 120;
    const centerX = (node.positionAbsolute?.x ?? node.position.x) + width / 2;
    const centerY = (node.positionAbsolute?.y ?? node.position.y) + height / 2;
    const zoom = Math.min(2, Math.max(0.25, getZoom() + direction * 0.2));

    setCenter(centerX, centerY, { zoom, duration: 350 });
  };

  return (
    <Panel position="bottom-left" className="roadmap-canvas-controls">
      <button type="button" aria-label="Zoom in on selected milestone" title="Zoom in on selected milestone" onClick={() => zoomAroundSelected(1)}>
        +
      </button>
      <button type="button" aria-label="Zoom out from selected milestone" title="Zoom out from selected milestone" onClick={() => zoomAroundSelected(-1)}>
        −
      </button>
      <button type="button" aria-label="Fit full roadmap" title="Fit full roadmap" onClick={() => fitView({ duration: 400, padding: 0.1 })}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </Panel>
  );
}

// Cycles through friendly status messages while the LLM/resource fetch is
// running, so the loading screen feels alive instead of a static spinner.
const LOADING_MESSAGES_QUESTIONS = [
  'Preparing questions…',
  'Almost ready…'
];
const LOADING_MESSAGES_ROADMAP = [
  'Building your roadmap…',
  'Ordering steps from beginner to advanced…',
  'Finding videos and articles…'
];

function InteractiveLoader({ messages }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [messages]);

  const points = [[20, 70], [80, 30], [140, 62], [200, 24], [260, 50]];

  return (
    <div className="rm-loader" role="status" aria-live="polite">
      <svg className="rm-loader-svg" viewBox="0 0 280 96" aria-hidden="true">
        <path className="rm-loader-track" d="M20 70 C 50 70, 50 30, 80 30 S 110 62, 140 62 S 170 24, 200 24 S 230 50, 260 50" />
        <path className="rm-loader-path" d="M20 70 C 50 70, 50 30, 80 30 S 110 62, 140 62 S 170 24, 200 24 S 230 50, 260 50" pathLength="100" />
        {points.map(([cx, cy], i) => (
          <g key={i} className="rm-loader-node" style={{ '--i': i }}>
            <circle className="rm-loader-halo" cx={cx} cy={cy} r="9" />
            <circle className="rm-loader-dot" cx={cx} cy={cy} r="4.5" />
          </g>
        ))}
      </svg>
      <p key={index} className="rm-loader-text">{messages[index]}</p>
      <div className="rm-loader-steps">
        {messages.map((_, i) => (
          <span key={i} className={i === index ? 'is-active' : ''} />
        ))}
      </div>
    </div>
  );
}

function RoadmapLab({ token, onExit, backLabel = 'Back' }) {
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
  const [resourcesDone, setResourcesDone] = useState(false);

  const resetSession = () => {
    setPhase('topic');
    setRoadmap(null);
    setSelectedNodeId(null);
    setSessionId(null);
    setQuestions([]);
    setAnswers([]);
    setNodes([]);
    setResources([]);
    setResourcesDone(false);
    setErrorMsg('');
  };

  const requestIdRef = useRef(0);
  const abortRef = useRef(null);

  const beginRequest = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestIdRef.current += 1;
    return { id: requestIdRef.current, signal: controller.signal };
  };

  const cancelLoading = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1; // invalidate any in-flight response
    setPhase(loadingKind === 'roadmap' ? 'questions' : 'topic');
  };

  // Abort any in-flight request if the user leaves the lab.
  useEffect(() => () => abortRef.current?.abort(), []);

  const friendlyError = (err) => {
    const msg = err?.message || 'Something went wrong.';
    if (msg === 'Failed to fetch') return 'Unable to reach the server. Check your connection and try again.';
    return msg.charAt(0).toUpperCase() + msg.slice(1);
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoadingKind('questions');
    setPhase('loading');
    setErrorMsg('');
    const { id, signal } = beginRequest();
    try {
      const res = await fetch(`${API_URL}/roadmap/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: topic.trim() }),
        signal,
      });
      const data = await readJson(res);
      if (id !== requestIdRef.current) return;
      if (!res.ok || !Array.isArray(data.questions)) throw new Error(data.error || 'Could not start a roadmap for this topic.');
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(''));
      setPhase('questions');
    } catch (err) {
      if (id !== requestIdRef.current || err.name === 'AbortError') return;
      setErrorMsg(friendlyError(err));
      setPhase('error');
    }
  };

  const handleSubmitAnswers = async (e) => {
    e.preventDefault();
    setLoadingKind('roadmap');
    setPhase('loading');
    setErrorMsg('');
    const { id, signal } = beginRequest();
    try {
      const res = await fetch(`${API_URL}/roadmap/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers }),
        signal,
      });
      const data = await readJson(res);
      if (id !== requestIdRef.current) return;
      if (!res.ok || !data.roadmap?.nodes) throw new Error(data.error || 'Could not generate the roadmap. Please try again.');
      setRoadmap(data.roadmap);
      setSelectedNodeId(data.roadmap.nodes[0]?.id || null);
      const positions = computeLayout(data.roadmap.nodes, data.roadmap.edges);
      setNodes(data.roadmap.nodes.map((node) => ({
        id: node.id,
        position: positions[node.id] || { x: 0, y: 0 },
        data: { label: node.label }
      })));
      setResources(data.resources || []);
      setResourcesDone(false);
      setPhase('result');
    } catch (err) {
      if (id !== requestIdRef.current || err.name === 'AbortError') return;
      setErrorMsg(friendlyError(err));
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
      if (cancelled) return;
      if (attempts >= maxAttempts) { setResourcesDone(true); return; }
      attempts += 1;
      try {
        const res = await fetch(`${API_URL}/roadmap/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await readJson(res);
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
          level: nodeStatusInfo.level[node.id] ?? 0,
        },
      };
    });
  }, [nodes, selectedNodeId, roadmap, nodeStatusInfo]);

  const flowEdges = useMemo(() => {
    if (!roadmap) return [];
    return roadmap.edges.map((e, i) => {
      const sourceStatus = nodeStatusInfo.statuses[e.source];
      const targetStatus = nodeStatusInfo.statuses[e.target];
      let kind = 'next';
      if (sourceStatus === 'completed' && (targetStatus === 'completed' || targetStatus === 'current')) kind = 'done';
      else if (sourceStatus === 'current') kind = 'active';
      else if (sourceStatus === 'locked') kind = 'locked';

      const sourceLevel = nodeStatusInfo.level[e.source] ?? 0;
      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        className: `rm-edge rm-edge-${kind}`,
        // Two delays: edge draw-in, then (active edges only) the dash flow after it finishes.
        style: { animationDelay: `${260 + sourceLevel * 110}ms, ${1060 + sourceLevel * 110}ms` },
      };
    });
  }, [roadmap, nodeStatusInfo]);

  const onNodeClick = useCallback((_, node) => setSelectedNodeId(node.id), []);

  const selectedNode = roadmap?.nodes.find((n) => n.id === selectedNodeId);
  const selectedResources = resources.find((r) => r.nodeId === selectedNodeId);
  const selectedStepIndex = roadmap?.nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNodeStatus = selectedNodeId ? (nodeStatusInfo.statuses[selectedNodeId] || 'current') : null;
  const totalSteps = roadmap?.nodes?.length || 0;
  const doneSteps = Object.values(nodeStatusInfo.statuses).filter((st) => st === 'completed').length;
  const progressPct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <div className={`roadmap-container ${phase === 'result' ? 'phase-result' : 'phase-form'}`}>
      {/* Topbar Header */}
      <div className="roadmap-topbar">
        <div className="roadmap-topbar-left">
          <h2 className="roadmap-header-title">Roadmap Lab</h2>
          <p className="roadmap-header-subtitle">
            {roadmap ? (
              <>
                <span className="roadmap-topic-highlight">{topic}</span> · {roadmap.nodes?.length || 0} steps
              </>
            ) : (
              'Generate a step-by-step learning path for any topic.'
            )}
          </p>
        </div>
        <div className="roadmap-topbar-actions">
          {phase === 'result' && (
            <button
              onClick={resetSession}
              className="roadmap-secondary-btn"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              New Topic
            </button>
          )}
          <button type="button" onClick={onExit} className="roadmap-exit-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {backLabel}
          </button>
        </div>
      </div>

      {/* Phase 1: Topic Input */}
      {phase === 'topic' && (
        <div className="roadmap-form-scroll-container">
          <form onSubmit={handleStart} className="roadmap-form-card">
            <div className="roadmap-card-tag">Step 1 of 2</div>
            <h3 className="roadmap-form-title">What do you want to learn?</h3>
            <p className="roadmap-form-desc">
              Pick a suggestion or type any skill or subject.
            </p>
            <div className="roadmap-chips-row">
              {['Machine Learning', 'Full-Stack Web Dev', 'System Design', 'UI/UX Design', 'Data Engineering', 'DevOps & Cloud'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={`roadmap-chip-btn ${topic === suggestion ? 'is-active' : ''}`}
                  onClick={() => setTopic(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="roadmap-input-wrapper">
              <input
                className="roadmap-input-field"
                placeholder="e.g. React, Python, Docker"
                aria-label="Topic"
                maxLength={80}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
              />
            </div>
            <div className="roadmap-form-actions">
              <button type="submit" disabled={!topic.trim()} className="roadmap-primary-btn">
                <span>Continue</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Phase 2: Questions */}
      {phase === 'questions' && (
        <div className="roadmap-form-scroll-container roadmap-questions-scroll">
          <form onSubmit={handleSubmitAnswers} className="roadmap-form-card roadmap-questions-form">
            <div className="roadmap-card-tag">Step 2 of 2</div>
            <h3 className="roadmap-form-title">A few quick questions</h3>
            <p className="roadmap-form-desc">
              Your answers tailor the roadmap for <span className="roadmap-topic-highlight">{topic}</span>. Leave any blank to skip.
            </p>
            <div className="roadmap-questions-list">
              {questions.map((q, i) => (
                <div key={i} className="roadmap-question-card">
                  <label className="roadmap-question-label">
                    <span className="roadmap-question-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="roadmap-question-text">{q}</span>
                  </label>
                  <input
                    className="roadmap-input-field roadmap-question-input"
                    placeholder="Your answer"
                    value={answers[i]}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="roadmap-questions-actions">
              <button
                type="button"
                onClick={() => setPhase('topic')}
                className="roadmap-secondary-btn"
              >
                Back
              </button>
              <button type="submit" className="roadmap-primary-btn">
                <span>Build roadmap</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Phase 3: Loading */}
      {phase === 'loading' && (
        <div className="rm-loader-wrap">
          <InteractiveLoader
            key={loadingKind}
            messages={loadingKind === 'questions' ? LOADING_MESSAGES_QUESTIONS : LOADING_MESSAGES_ROADMAP}
          />
          <button type="button" onClick={cancelLoading} className="roadmap-secondary-btn rm-loader-cancel">
            Cancel
          </button>
        </div>
      )}

      {/* Phase 4: Error */}
      {phase === 'error' && (
        <div className="roadmap-form-scroll-container">
          <div className="roadmap-error-card">
            <p className="roadmap-error-text">{errorMsg}</p>
            <div className="roadmap-questions-actions" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
              <button type="button" onClick={onExit} className="roadmap-secondary-btn">
                {backLabel}
              </button>
              <button type="button" onClick={() => setPhase(loadingKind === 'roadmap' ? 'questions' : 'topic')} className="roadmap-primary-btn">
                Try again
              </button>
            </div>
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
                  <div className="canvas-header-title">Learning path</div>
                  <div className="canvas-header-sub">Prerequisites flow left to right. Select a step to see its resources.</div>
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
                  {flowNodes.length} steps
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
                minZoom={0.25}
                maxZoom={2}
                fitViewOptions={{ padding: 0.1, minZoom: 0.6, maxZoom: 1.15 }}
                colorMode="dark"
              >
                <Background color="rgba(231, 229, 228, 0.07)" gap={22} size={1.2} />
                <RoadmapCanvasControls selectedNodeId={selectedNodeId} />
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
                <h3>Select a step</h3>
                <p>Click a step in the graph to see its description and learning resources.</p>
              </div>
            )}

            {selectedNode && (
              <div key={selectedNode.id} className="selected-node-container step-details-animated">
                {/* Step Header */}
                <div className="node-detail-header">
                  <div className="node-detail-tag-row">
                    <span className={`status-pill pill-${selectedNodeStatus}`}>
                      {selectedNodeStatus === 'completed' && 'Done'}
                      {selectedNodeStatus === 'current' && 'Current'}
                      {selectedNodeStatus === 'locked' && 'Upcoming'}
                      {selectedNodeStatus === 'available' && 'Ready'}
                    </span>
                    <span className="step-count-pill">
                      Step {(selectedStepIndex != null && selectedStepIndex >= 0 ? selectedStepIndex + 1 : 1)} of {roadmap.nodes.length}
                    </span>
                  </div>
                  <h3 className="node-detail-title">{selectedNode.label}</h3>
                  {selectedNode.description && (
                    <div className="node-detail-desc-box">
                      <p className="node-detail-desc">{selectedNode.description}</p>
                    </div>
                  )}
                </div>

                <div className="rm-progress">
                  <div className="rm-progress-row">
                    <span>Path progress</span>
                    <span className="rm-progress-value">{doneSteps} of {totalSteps} done</span>
                  </div>
                  <div className="rm-progress-track">
                    <div className="rm-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div className="resource-divider" />

                {/* Curated Resources Section */}
                <div className="resources-section">
                  {!selectedResources?.youtube?.length && !selectedResources?.articles?.length ? (
                    // Resources arrive as one batch: once any exist (or polling gave up),
                    // an empty step means there is nothing for it, not that it's still loading.
                    resourcesDone || resources.length > 0 ? (
                      <div className="resources-loading-state">
                        <p className="canvas-header-sub" style={{ margin: 0 }}>
                          No resources are available for this step yet.
                        </p>
                      </div>
                    ) : (
                      <div className="resources-loading-state">
                        <div className="resources-loading-badge">
                          <span className="resource-spin-dot" />
                          <span>Finding videos and articles…</span>
                        </div>
                        <div className="skeleton-card shimmer" />
                        <div className="skeleton-card shimmer" />
                      </div>
                    )
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
                              <h4>Videos</h4>
                            </div>
                            <span className="group-count-badge">
                              {selectedResources.youtube.length}
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
                                    <span className="resource-tag video-tag">Video</span>
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
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                              </svg>
                              <h4>Articles</h4>
                            </div>
                            <span className="group-count-badge">
                              {selectedResources.articles.length}
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
                                    <span className="resource-tag article-tag">Article</span>
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