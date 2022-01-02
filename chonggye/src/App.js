import { useCallback, useEffect, useState } from 'react';
import './App.css';

const ipcRenderer =window.require("electron").ipcRenderer;

const joinURL = (url) => {
  const found = /^https:\/\/.*zoom\.us\/j\/(\d+)\?pwd=(\w+)(?:#.+)?$/g.exec(url);
  if (found) {
    const newURL = `zoommtg://zoom.us/join?confno=${found[1]}&pwd=${found[2]}&zc=0&browser=chrome`;
    ipcRenderer.invoke("OPEN", newURL);
  } else {
    ipcRenderer.invoke("OPEN", url);
  }
}


const ZoomURL = ({url, remove, update}) => {
  const [name, setName] = useState(url?.name);
  const [realURL, setRealURL] = useState(url?.url);
  useEffect(() => {
    setName(url.name);
    setRealURL(url.url);
  }, [url])

  const updateName = () => {
    update({...url, name: name});
  }
  const updateURL = () => {
    update({...url, url: realURL});
  }

  return (<div className="zoom-url-element">
        <input type="text"  className="zoom-url-element-title" value={name} onChange={(ev) => setName(ev.target.value)} onKeyPress={event => {
              if (event.key === 'Enter') { updateName(); event.target.blur()}
            }} onBlur={updateName}/>
        
        <input type="text"  className="zoom-url-element-url" value={realURL} onChange={(ev) => setRealURL(ev.target.value)} onKeyPress={event => {
              if (event.key === 'Enter') { updateURL(); event.target.blur()}
            }} onBlur={updateURL}/>
        <button className="zoom-url-element-join" onClick={() => {joinURL(url.url)}}>접속</button>
        <button className="zoom-url-element-button" onClick={remove}>x</button>
      </div>)
}

const ZoomURLS = ({urls, addURL, removeURL, updateURL}) => {
  return <div className="zoom-url-parent">
      {urls.map(a => (
        <ZoomURL key={a.id} url={a} remove={() => removeURL(a)} update={(a) => updateURL(a.id, a)}/>
      ))}
    <button className="zoom-url-element-addbutton" onClick={() => addURL({id: (new Date()).getTime(), name: "과목", url: "zoom"})}>+</button>
  </div>
}

const ComciganSearch = ({callback, ...props}) => {
  const [search, setSearch] = useState("");

  const [searched, setSearched] = useState([]);

  const doSearch = () => {
    ipcRenderer.invoke("COMCIGAN_SEARCH", search).then(res => {
      setSearched(res);
    })
  }

  return <><div className="comcigan-search-parent">
    <input type="text" value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="학교이름"/> 
    <button onClick={doSearch}>검색</button>
  </div>
  <div className="comcigan-search-result">
    {searched.map(a => (
    <div className="comcigan-search-result-child">
      <span className="comcigan-search-result-name">{a.region}: {a.name}</span>
      <button className="comcigan-search-result-button" onClick={() => callback(a.code)}>선택</button>
    </div>))}
  </div>
  </>
}

const ComciganCalendar = ({comciganData, setComciganData,timeData, setTimeData, urls, autoJoin, setAutoJoin}) => {

  useEffect(() => {
    ipcRenderer.invoke("COMICGAN_GETTIMETABLE", comciganData.code).then(a => {
      const array = [];
      for (const [key, period] of a[1].entries()) {
        const res = /^.+\((\d+):(\d+)\)$/g.exec(period);
        const hr = Number(res[1]), min = Number(res[2]);
        array.push({period: key, hr: hr, min: min, minSinceDay: (hr * 60 + min) });
      }


      setTimeData({classSpecific: a[0], periods: a[1], parsed: array});
    })
  }, [comciganData.code, setTimeData])

  const target = timeData?.classSpecific?.[comciganData.grade]?.[comciganData.class]?.[new Date().getDay()-1];

  const periodUpdate = (period) => {
    console.log("periodUpdate");
    const subject = target[period].subject;
    const url = urls.filter(a => a.name === subject)?.[0]?.url;
    if (url !== undefined && url !== null && autoJoin) joinURL(url);
  }

  return <div>
    <div className="comcigan-search-class-parent">
      <button onClick={() => {setComciganData(null)}}>{'<'}</button>
      <label><input type="checkbox" value="autojoin" checked={autoJoin} onChange={() => {
        setAutoJoin(!autoJoin);
      }}/> 5분전 자동접속</label>
      <div>
        <span>반: </span>
        <select onChange={(e) => {
          const newVal = e.target.value;
          const split = newVal.split("-");
          console.log(split)
          setComciganData({...comciganData, grade: split[0], class: split[1]});
        }} value={comciganData.grade +"-"+comciganData.class}>
          {Object.entries(timeData.classSpecific === undefined ? {} : timeData.classSpecific).map(([k,v]) => Object.entries(v).map(([k2,v2]) => (
            <option key={k+"-"+k2} value={k+"-"+k2}>
              {k}-{k2}
            </option>
          )))}
        </select>
      </div>
    </div>
    {target !== undefined && (<Table target={target} timeData={timeData} urls={urls} autoJoin={autoJoin} periodUpdate={periodUpdate}/>)}
  </div>
}

const getCurrentPeriod = (currOffset,parsed) => {
  let period_curr;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].minSinceDay-5 <= currOffset) period_curr = i;
  }
  return period_curr;
}

const Table = ({target, timeData, urls, autoJoin, periodUpdate, ...props}) => {
  

  const [date, setDate] = useState(new Date());
  const [currOffset, setCurrOffset] = useState(date.getHours() * 60 + date.getMinutes());
  const [currentPeriod, setCurrentPeriod] = useState(getCurrentPeriod(currOffset, timeData.parsed));
  const [prevPeriod, setPrevPeriod] = useState(getCurrentPeriod(currOffset, timeData.parsed));
  useEffect(() => {
    setCurrOffset(date.getHours() * 60 + date.getMinutes());
  }, [date, setCurrOffset]);

  const updateTime = useCallback(() => {
    setDate(new Date());
    const curr = new Date();
    const target = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), curr.getHours(), curr.getMinutes(), 0);
    const a = setTimeout(updateTime, target.getTime() - curr.getTime() + 60000);
    return () => clearTimeout(a);
  }, [setDate])
  useEffect(updateTime, [updateTime]);
  useEffect(() => {
    setCurrentPeriod(getCurrentPeriod(currOffset, timeData.parsed));
  }, [currOffset, timeData.parsed])

  useEffect(() => {
    if (prevPeriod !== currentPeriod) periodUpdate(currentPeriod)
    setPrevPeriod(currentPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriod])

  return (<table className="comcigan-table">
  <thead>
    <tr>
      <th colSpan={3}>{target[0].weekdayString}요일</th>
    </tr>
    <tr>
      <th>교시</th>
      <th>과목</th>
      <th>줌</th>
    </tr>
  </thead>
  <tbody>
    {target.filter((a,i) => a.subject !== "").map((v,i) => {
      const url = urls.filter(a => a.name === v.subject)?.[0]?.url;
      return (<tr key={i} className={currentPeriod === i ? "class-progress" : currentPeriod > i ? "class-done" : ""}>
        <td>{i+1}교시<br/>{timeData.periods[i]}</td>
        <td>{v.subject}<br/>{v.teacher}*</td>
        <td>{url ? (
          <button className="join" onClick={() => {joinURL(url)}}>접속</button>
        ) : (<span>X</span>)}</td>
      </tr>)
    })}
  </tbody>
</table>)
}

const Comcigan = ({comciganData, setComciganData, timeData, setTimeData, urls, autoJoin, setAutoJoin, ...props}) => {
  if (comciganData === null) {
    return <ComciganSearch callback={(code) => {
      setComciganData({code: code, grade: 1, class: 1});
    }}/>
  } 
  return <ComciganCalendar comciganData={comciganData} setComciganData={setComciganData} timeData={timeData} setTimeData={setTimeData} urls={urls} autoJoin={autoJoin} setAutoJoin={setAutoJoin}/>
}


function App() {
  const [urls, setURLs] = useState([]);
  const [comciganData, setComciganData] = useState(null);
  const [localTimedata, setLocaltimedata] = useState({});
  const [autoJoin, setAutoJoin] = useState(true);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    ipcRenderer.invoke("GET_CONFIG", "settings").then(defaultState => {
      if (defaultState.data) {
        setURLs(defaultState.data.urls ?? urls)
        setComciganData(defaultState.data.comciganData ?? comciganData);
        setAutoJoin(defaultState.data.autoJoin ?? autoJoin);
      } 
      setLoading(false);
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const saveConfig = () => {
    if (loading) return;
    ipcRenderer.invoke("SAVE_CONFIG", "settings", {urls: urls, comciganData: comciganData, autoJoin: autoJoin});
  }
  useEffect(saveConfig, [comciganData, urls, autoJoin, loading]);
  if (loading) {
    return <div id="App">
      Loading
    </div>
  }

  return (
    <div id="App">
      <div className="column">
        <span className="title">줌 주소</span><hr/>
        <ZoomURLS urls={urls} 
        addURL={(url) => {setURLs([...urls, url])}}
        removeURL={(url) => {setURLs(urls.filter(a => a !== url))}}
        updateURL={(id, url) => {
          const idx = urls.findIndex(a => a.id === id);
          const copy = [...urls];
          copy[idx] = url;
          setURLs(copy);
        }}/>
      </div>
      <div className="column">
        <span className="title">시간표</span><hr/>
        <div className="scroll">
          <Comcigan comciganData={comciganData} setComciganData={setComciganData} timeData={localTimedata} setTimeData={setLocaltimedata} urls={urls} autoJoin={autoJoin} setAutoJoin={setAutoJoin}/>
        </div>
      </div>
    </div>
  );
}

export default App;
