// static/index.js — Full SPA with Tailwind, Wizard + List nav

const { useState, useEffect } = React;
const axios = window.axios;

// --- Catalogs Page ---
function CatalogsPage() {
  const [mode, setMode] = useState('func');        // func | restr | cond
  const [items, setItems] = useState([]);
  const [newEntry, setNewEntry] = useState('');
  const [error,     setError]     = useState('');

  // Load whichever catalog we’re on
  useEffect(() => {
    const urlMap = { func: '/functionalities', restr: '/restrictions', cond: '/conditions' };
    axios.get(urlMap[mode]).then(r => setItems(r.data));
  }, [mode]);

  const handleAdd = () => {
    setError('');
    if (!newEntry.trim()) {
        setError('Please enter a name.')
        return;
    }
    const urlMap = { func: '/functionalities', restr: '/restrictions', cond: '/conditions' };
    axios.post(urlMap[mode], { name: newEntry })
         .then(() => { setNewEntry(''); return axios.get(urlMap[mode]); })
         .then(r => setItems(r.data));
  };

  const labels = {
    func: ['Functionalities','Add Functionality'],
    restr: ['Restrictions','Add Restriction'],
    cond: ['Conditions','Add Condition']
  };

  return (
    <div className="page">
      <h2>{labels[mode][0]}</h2>
      <div className="tabs">
        <button onClick={()=>setMode('func')}  className={mode==='func' ? 'active' : ''}>Functionalities</button>
        <button onClick={()=>setMode('restr')} className={mode==='restr'? 'active' : ''}>Restrictions</button>
        <button onClick={()=>setMode('cond')}  className={mode==='cond' ? 'active' : ''}>Conditions</button>
      </div>
      <div className="input-group">
        <input
          type="text"
          className="flex-1"
          placeholder={labels[mode][1]}
          value={newEntry}
          onChange={e=>setNewEntry(e.target.value)}
        />
        <button onClick={handleAdd}>Add</button>
      </div>
      <ul className="list">
        {items.map(i => <li key={i.id}>{i.name}</li>)}
      </ul>
    </div>
  );
}

// --- Soldier Wizard + List ---
function SoldierWizard({ onFinish }) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [personalId,setPersonalId]= useState('');
  const [funcId,    setFuncId]    = useState(null);  // single choice
  const [restrIds,  setRestrIds]  = useState([]);
  const [incompat,  setIncompat]  = useState([]);
  const [funcs,     setFuncs]     = useState([]);
  const [restrs,    setRestrs]    = useState([]);
  const [soldiers,  setSoldiers]  = useState([]);
  const [error,     setError]     = useState('');

  useEffect(() => {
    axios.get('/functionalities').then(r=>setFuncs(r.data));
    axios.get('/restrictions')   .then(r=>setRestrs(r.data));
    axios.get('/soldiers')       .then(r=>setSoldiers(r.data));
  }, []);

  const steps = [
    { title: 'Personal Info', content: (
        <div className="space-y-3">
          <input
            className="w-full p-2 border rounded"
            placeholder="First Name"
            value={firstName}
            onChange={e=>setFirstName(e.target.value)}
          />
          <input
            className="w-full p-2 border rounded"
            placeholder="Last Name"
            value={lastName}
            onChange={e=>setLastName(e.target.value)}
          />
          <input
            className="w-full p-2 border rounded"
            placeholder="Personal ID"
            value={personalId}
            onChange={e=>setPersonalId(e.target.value)}
          />
        </div>
      )
    },
    { title: 'Functionality',
      content: (
        <div className="space-y-2">
          {funcs.map(f => (
            <label key={f.id} className="flex items-center">
              <input
                type="radio"
                name="func"
                value={f.id}
                checked={funcId === f.id}
                onChange={()=>setFuncId(f.id)}
              />
              <span className="ml-2">{f.name}</span>
            </label>
          ))}
        </div>
      )
    },
    { title: 'Restrictions',
      content: (
        <div className="space-y-2 max-h-48 overflow-auto">
          {restrs.map(r => (
            <label key={r.id} className="flex items-center">
              <input
                type="checkbox"
                checked={restrIds.includes(r.id)}
                onChange={() => {
                  if (restrIds.includes(r.id))
                    setRestrIds(restrIds.filter(x=>x!==r.id));
                  else
                    setRestrIds([...restrIds, r.id]);
                }}
              />
              <span className="ml-2">{r.name}</span>
            </label>
          ))}
        </div>
      )
    },
    { title: 'Incompatible With',
      content: (
        <div className="space-y-2 max-h-48 overflow-auto">
          {soldiers.map(s => (
            <label key={s.id} className="flex items-center">
              <input
                type="checkbox"
                checked={incompat.includes(s.id)}
                onChange={() => {
                  if (incompat.includes(s.id))
                    setIncompat(incompat.filter(x=>x!==s.id));
                  else
                    setIncompat([...incompat, s.id]);
                }}
              />
              <span className="ml-2">
                {s.first_name} {s.last_name}
              </span>
            </label>
          ))}
        </div>
      )
    }
  ];

  const onNext = () => {
    setError('');
    // step-by-step validation
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('First and last name are required.');
        return;
      }
    }
    if (step === 1) {
      if (funcId === null) {
        setError('Please choose exactly one functionality.');
        return;
      }
    }
    // no further mandatory checks for restrictions/incompat

    // final submit
    if (step === steps.length - 1) {
      axios.post('/soldiers', {
        first_name: firstName,
        last_name:  lastName,
        personal_id: personalId,
        functionality_ids: [funcId],
        restriction_ids:    restrIds,
        incompatible_ids:   incompat,
      }).then(onFinish);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="page bg-white p-6 rounded shadow space-y-4">
      <h3 className="text-xl font-semibold">{steps[step].title}</h3>
      {steps[step].content}

      {error && <div className="text-red-600">{error}</div>}

      <div className="flex justify-between">
        {step > 0 && (
          <button
            type="button"
            onClick={() => { setError(''); setStep(step - 1); }}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {step < steps.length - 1 ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  );
}


// --- SoldiersPage ---
function SoldiersPage() {
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldier, setSelectedSoldier] = useState(null);

  useEffect(() => {
    axios.get('/soldiers').then(r => setSoldiers(r.data));
  }, []);

  const removeSoldier = id => {
    axios.delete(`/soldiers/${id}`)
      .then(() => setSoldiers(ss => ss.filter(s => s.id !== id)))
      .finally(() => {
        // replace optional chaining with explicit check
        if (selectedSoldier && selectedSoldier.id === id) {
          setSelectedSoldier(null);
        }
      });
  };

  return (
    <div className="page">
      <h2>Soldiers</h2>
      <ul className="list mb-6">
        {soldiers.map(s => (
          <li key={s.id} className="flex justify-between items-center">
            <button
              className="text-left flex-1"
              onClick={() => setSelectedSoldier(s)}
            >
              {s.index}. {s.first_name} {s.last_name}
            </button>
            <button
              className="btn-sm del"
              onClick={() => removeSoldier(s.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {selectedSoldier && (
        <div className="p-4 bg-white border rounded shadow">
          <h3 className="text-lg font-semibold">
            {selectedSoldier.first_name} {selectedSoldier.last_name}
          </h3>
          <p><strong>Personal ID:</strong> {selectedSoldier.personal_id || '—'}</p>
          <p><strong>Functionalities:</strong> {selectedSoldier.functionalities.join(', ') || '—'}</p>
          <p><strong>Restrictions:</strong> {selectedSoldier.restrictions.join(', ') || '—'}</p>
          <p>
            <strong>Incompatible With:</strong>{' '}
            {selectedSoldier.incompatible_ids.length > 0
              ? selectedSoldier.incompatible_ids.join(', ')
              : '—'
            }
          </p>
          <button
            className="mt-4 px-3 py-1 bg-gray-200 rounded"
            onClick={() => setSelectedSoldier(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
);
}


// --- Positions Page ---
function PositionsPage() {
  const [positions, setPositions] = useState([]);
  const [funcs, setFuncs] = useState([]);
  const [conds, setConds] = useState([]);
  const [restrs, setRestrs] = useState([]);

  // Form state
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [funcIds, setFuncIds] = useState([]);
  const [selConds, setSelConds] = useState([]);
  const [selRestrs, setSelRestrs] = useState([]);

  // Load dropdowns + list
  const loadAll = () => {
    axios.get('/positions').then(r => setPositions(r.data));
    axios.get('/functionalities').then(r => setFuncs(r.data));
    axios.get('/conditions').then(r => setConds(r.data));
    axios.get('/restrictions').then(r => setRestrs(r.data));
  };
  useEffect(loadAll, []);

  const addPosition = () => {
    if (!name.trim()) return;
    axios.post('/positions', {
      name,
      required_count: count,
      functionality_ids: funcIds,
      condition_ids: selConds,
      restriction_ids: selRestrs
    }).then(() => {
      setName(''); setCount(1);
      setFuncIds([]); setSelConds([]); setSelRestrs([]);
      loadAll();
    });
  };

  return (
    <div className="page">
      <h2>Positions</h2>

      {/* Add Position Form */}
      <div className="form-row mb-4">
        <input
          className="flex-1 p-2 border rounded"
          placeholder="Position Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="number"
          className="w-20 p-2 border rounded mx-2"
          placeholder="Count"
          value={count}
          onChange={e => setCount(+e.target.value)}
        />
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={addPosition}
        >
          Add Position
        </button>
      </div>

      {/* Multi-select options */}
      <div className="form-row small-grid mb-6">
        <div>
          <label className="block mb-1">Required Functionalities</label>
          <select
            multiple
            className="w-full p-2 border rounded h-24"
            value={funcIds}
            onChange={e =>
              setFuncIds(Array.from(e.target.selectedOptions, o => +o.value))
            }
          >
            {funcs.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1">Conditions</label>
          <select
            multiple
            className="w-full p-2 border rounded h-24"
            value={selConds}
            onChange={e =>
              setSelConds(Array.from(e.target.selectedOptions, o => +o.value))
            }
          >
            {conds.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1">Restrictions</label>
          <select
            multiple
            className="w-full p-2 border rounded h-24"
            value={selRestrs}
            onChange={e =>
              setSelRestrs(Array.from(e.target.selectedOptions, o => +o.value))
            }
          >
            {restrs.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Existing Positions List */}
      <ul className="list">
        {positions.map(p => (
          <li key={p.id}>
            {p.name} (×{p.required_count})
            {p.functionalities.length > 0 &&
              `, funcs: ${p.functionalities.join(', ')}`}
            {p.conditions.length > 0 &&
              `, conds: ${p.conditions.join(', ')}`}
            {p.restrictions.length > 0 &&
              `, restrs: ${p.restrictions.join(', ')}`}
          </li>
        ))}
      </ul>
    </div>
  );
}



// --- Shifts Page ---
function ShiftsPage() {
  const [positions, setPositions] = useState([]);
  const [shiftTimes, setShiftTimes] = useState([
    { start: '08:00', end: '12:00' },
    { start: '12:00', end: '16:00' },
  ]);
  const [duties, setDuties] = useState([]);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    axios.get('/positions').then(r => setPositions(r.data));
    axios.get('/guard_duties').then(r => setDuties(r.data));
  }, []);

  const generateAndSave = () => {
    console.log('➤ Generate button clicked');
    axios.post('/generate_shifts', { shift_times: shiftTimes })
      .then(r => {
        console.log('➤ /generate_shifts response', r.data);
        setWarnings(r.data.warnings || []);
        return Promise.all(
          r.data.generated_shifts.map(gs => {
            const pos = positions.find(p => p.name === gs.station);
            return axios.post('/guard_duties', {
              soldier_id:    gs.soldier_id,
              position_id:   pos.id,
              start_time:    gs.start_time,
              end_time:      gs.end_time
            });
          })
        );
      })
      .then(() => axios.get('/guard_duties').then(r => setDuties(r.data)))
      .catch(err => console.error('Error generating/saving shifts', err));
  };

  return (
    <div className="page space-y-4">
      <h2>Shifts &amp; Duties</h2>

      {warnings.map((w,i) => (
        <div key={i} className="error">{w}</div>
      ))}

      <div className="form-row small-grid">
        {shiftTimes.map((s,i) => (
          <div key={i} className="shift-time">
            <input
              type="time"
              value={s.start}
              onChange={e=>{
                const u=[...shiftTimes]; u[i].start=e.target.value; setShiftTimes(u);
              }}
            />
            <input
              type="time"
              value={s.end}
              onChange={e=>{
                const u=[...shiftTimes]; u[i].end=e.target.value; setShiftTimes(u);
              }}
            />
          </div>
        ))}
      </div>

      {/* <<< IMPORTANT: add type="button" >>> */}
      <button
        type="button"
        onClick={generateAndSave}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Generate &amp; Save Shifts
      </button>

      <h3 className="mt-6 text-lg font-medium">Existing Guard Duties</h3>
      <ul className="list">
        {duties.map(d => (
          <li key={d.id} className="flex justify-between">
            <span>
              <strong>{d.position}</strong> – {d.soldier}<br/>
              {new Date(d.start_time).toLocaleTimeString()}–
              {new Date(d.end_time).toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={()=>axios
                .delete(`/guard_duties/${d.id}`)
                .then(()=> setDuties(ds => ds.filter(x=>x.id!==d.id)))
              }
              className="btn-sm del"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}




// --- Main App ---
function App() {
  const [mode, setMode] = useState('catalogs');
  const reloadSoldiers = () => window.location.reload();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Guard Management</h1>
      <nav className="space-x-4">
        {['catalogs','soldiers','positions','shifts'].map(m=>(
          <button
            key={m}
            onClick={()=>setMode(m)}
            className={`px-3 py-1 rounded ${
              mode===m?'bg-blue-600 text-white':'bg-gray-200 text-gray-700'
            }`}
          >
            {m.charAt(0).toUpperCase()+m.slice(1)}
          </button>
        ))}
      </nav>

      {mode==='catalogs' && <CatalogsPage/>}
      {mode==='soldiers' && (
        <div>
            <SoldierWizard onFinish={reloadSoldiers}/>
            <SoldiersPage/>
        </div>
        )}
      {mode==='positions' && <PositionsPage/>}
      {mode==='shifts' && <ShiftsPage/>}
    </div>
  );
}

ReactDOM.render(<App/>, document.getElementById('root'));
