const { useState, useEffect } = React;
const axios = window.axios;

const App = () => {
    const [soldiers, setSoldiers] = useState([]);
    const [stations, setStations] = useState([]);
    const [newSoldierName, setNewSoldierName] = useState("");
    const [isMagCertified, setIsMagCertified] = useState(false);
    const [newStationName, setNewStationName] = useState("");
    const [requiredSoldiers, setRequiredSoldiers] = useState(1);
    const [requiresMag, setRequiresMag] = useState(false);
    const [shiftTimes, setShiftTimes] = useState([
        { start: "12:00", end: "04:00" },
        { start: "04:00", end: "08:00" },
        { start: "08:00", end: "12:00" },
    ]);
    const [generatedShifts, setGeneratedShifts] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        axios.get('/soldiers').then(response => {
            setSoldiers(response.data);
        }).catch(error => {
            console.error("Error fetching soldiers:", error);
            alert("Error fetching soldiers: " + error.message);
        });

        axios.get('/stations').then(response => {
            setStations(response.data);
        }).catch(error => {
            console.error("Error fetching stations:", error);
            alert("Error fetching stations: " + error.message);
        });
    };

    const handleAddSoldier = () => {
        axios.post('/soldiers', { name: newSoldierName, is_mag_certified: isMagCertified })
            .then(response => {
                fetchData();
                setNewSoldierName("");
                setIsMagCertified(false);
            }).catch(error => {
                console.error("Error adding soldier:", error);
                alert("Error adding soldier: " + error.message);
            });
    };

    const handleRemoveSoldier = (id) => {
        axios.delete(`/soldiers/${id}`)
            .then(response => {
                fetchData();
            }).catch(error => {
                console.error("Error removing soldier:", error);
                alert("Error removing soldier: " + error.message);
            });
    };

    const handleAddStation = () => {
        axios.post('/stations', { name: newStationName, required_soldiers: requiredSoldiers, requires_mag: requiresMag })
            .then(response => {
                fetchData();
                setNewStationName("");
                setRequiredSoldiers(1);
                setRequiresMag(false);
            }).catch(error => {
                console.error("Error adding station:", error);
                alert("Error adding station: " + error.message);
            });
    };

    const handleRemoveStation = (id) => {
        axios.delete(`/stations/${id}`)
            .then(response => {
                fetchData();
            }).catch(error => {
                console.error("Error removing station:", error);
                alert("Error removing station: " + error.message);
            });
    };

    const handleShiftChange = (index, field, value) => {
        const newShiftTimes = [...shiftTimes];
        newShiftTimes[index][field] = value;
        setShiftTimes(newShiftTimes);
    };

    const handleGenerateShifts = () => {
        axios.post('/generate_shifts', { shift_times: shiftTimes })
            .then(response => {
                if (response.data.error) {
                    setErrorMessage(response.data.error);
                } else {
                    setErrorMessage("");
                    setGeneratedShifts(response.data.generated_shifts);
                }
            }).catch(error => {
                console.error("Error generating shifts:", error);
                setErrorMessage("Failed to generate shifts");
            });
    };

    return (
        <div>
            <h1>Guard Management</h1>
            <div className="container">
                <div className="section">
                    <h2>Add Soldier</h2>
                    <input
                        type="text"
                        placeholder="Soldier Name"
                        value={newSoldierName}
                        onChange={(e) => setNewSoldierName(e.target.value)}
                    />
                    <label>
                        MAG Certified:
                        <input
                            type="checkbox"
                            checked={isMagCertified}
                            onChange={() => setIsMagCertified(!isMagCertified)}
                        />
                    </label>
                    <button onClick={handleAddSoldier}>Add Soldier</button>
                </div>
                <div className="section">
                    <h2>Soldiers</h2>
                    <ul>
                        {soldiers.map(soldier => (
                            <li key={soldier.id}>
                                {soldier.index}. {soldier.name} {soldier.is_mag_certified && '(MAG)'} <button onClick={() => handleRemoveSoldier(soldier.id)}>Remove</button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="section">
                    <h2>Add Station</h2>
                    <input
                        type="text"
                        placeholder="Station Name"
                        value={newStationName}
                        onChange={(e) => setNewStationName(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Required Soldiers"
                        value={requiredSoldiers}
                        onChange={(e) => setRequiredSoldiers(parseInt(e.target.value))}
                    />
                    <label>
                        Requires MAG:
                        <input
                            type="checkbox"
                            checked={requiresMag}
                            onChange={() => setRequiresMag(!requiresMag)}
                        />
                    </label>
                    <button onClick={handleAddStation}>Add Station</button>
                </div>
                <div className="section">
                    <h2>Stations</h2>
                    <ul>
                        {stations.map(station => (
                            <li key={station.id}>
                                {station.name} (Requires {station.required_soldiers} soldiers{station.requires_mag ? ", MAG required" : ""}) <button onClick={() => handleRemoveStation(station.id)}>Remove</button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="section">
                    <h2>Shift Times</h2>
                    {shiftTimes.map((shift, index) => (
                        <div key={index}>
                            <input
                                type="time"
                                value={shift.start}
                                onChange={(e) => handleShiftChange(index, 'start', e.target.value)}
                            />
                            to
                            <input
                                type="time"
                                value={shift.end}
                                onChange={(e) => handleShiftChange(index, 'end', e.target.value)}
                            />
                        </div>
                    ))}
                </div>
                <div className="section">
                    <h2>Generate Shifts</h2>
                    <button onClick={handleGenerateShifts}>Generate Shifts</button>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <div className="generated-shifts">
                        <h2>Generated Shifts</h2>
                        <ul>
                            {generatedShifts.map((shift, index) => (
                                <li key={index}>
                                    <strong>Station:</strong> {shift.station}<br />
                                    <strong>Soldiers:</strong> {shift.soldiers.map(s => `${s.name} ${s.is_mag_certified ? '(MAG)' : ''}`).join(', ')}<br />
                                    <strong>Time:</strong> {new Date(shift.start_time).toLocaleTimeString()} - {new Date(shift.end_time).toLocaleTimeString()}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
