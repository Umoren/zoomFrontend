/* globals zoomSdk */
import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { apis } from "./apis";
import { Authorization } from "./components/Authorization";
import ApiScrollview from "./components/ApiScrollview";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
// import DarkModeToggle from "./components/DarkModeToggle";
import Colors from "./components/Colors";
import { useGlobalContext } from "./components/context";
import Alert from "./components/Alert";
import List from "./components/List";
import { FaGithub } from 'react-icons/fa'
import { v4 as uuid } from "uuid";
import { DragDropContext } from "react-beautiful-dnd";
import { Routes, Route, } from "react-router-dom";
import UserInfo from "./components/UserInfo";
import Image from "./components/Image";
import IFrame from "./components/IFrame";


let once = 0; // to prevent increasing number of event listeners being added

function App() {
  const history = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [runningContext, setRunningContext] = useState(null);
  const [connected, setConnected] = useState(false);
  const [counter, setCounter] = useState(0);
  const [preMeeting, setPreMeeting] = useState(true); // start with pre-meeting code
  const [userContextStatus, setUserContextStatus] = useState("");

  console.log("show me location", location)

  useEffect(() => {
    async function configureSdk() {
      // to account for the 2 hour timeout for config
      const configTimer = setTimeout(() => {
        setCounter(counter + 1);
      }, 120 * 60 * 1000);

      try {
        // Configure the JS SDK, required to call JS APIs in the Zoom App
        // These items must be selected in the Features -> Zoom App SDK -> Add APIs tool in Marketplace
        const configResponse = await zoomSdk.config({
          capabilities: [
            // apis demoed in the buttons
            ...apis.map((api) => api.name), // IMPORTANT

            // demo events
            "onSendAppInvitation",
            "onShareApp",
            "onActiveSpeakerChange",
            "onMeeting",

            // connect api and event
            "connect",
            "onConnect",
            "postMessage",
            "onMessage",

            // in-client api and event
            "authorize",
            "onAuthorized",
            "promptAuthorize",
            "getUserContext",
            "onMyUserContextChange",
            "sendAppInvitationToAllParticipants",
            "sendAppInvitation",
          ],
          version: "0.16.0",
        });
        console.log("App configured", configResponse);
        // The config method returns the running context of the Zoom App
        setRunningContext(configResponse.runningContext);
        setUserContextStatus(configResponse.auth.status);
        zoomSdk.onSendAppInvitation((data) => {
          console.log(data);
        });
        zoomSdk.onShareApp((data) => {
          console.log(data);
        });
      } catch (error) {
        console.log(error);
        setError("There was an error configuring the JS SDK");
      }
      return () => {
        clearTimeout(configTimer);
      };
    }
    configureSdk();
  }, [counter]);

  // PRE-MEETING
  let on_message_handler_client = useCallback(
    (message) => {
      let content = message.payload.payload;
      if (content === "connected" && preMeeting === true) {
        console.log("Meeting instance exists.");
        zoomSdk.removeEventListener("onMessage", on_message_handler_client);
        console.log("Letting meeting instance know client's current state.");
        sendMessage(window.location.hash, "client");
        setPreMeeting(false); // client instance is finished with pre-meeting
      }
    },
    [preMeeting]
  );

  // PRE-MEETING
  useEffect(() => {
    if (runningContext === "inMainClient" && preMeeting === true) {
      zoomSdk.addEventListener("onMessage", on_message_handler_client);
    }
  }, [on_message_handler_client, preMeeting, runningContext]);

  async function sendMessage(msg, sender) {
    console.log(
      "Message sent from " + sender + " with data: " + JSON.stringify(msg)
    );
    console.log("Calling postmessage...", msg);
    await zoomSdk.postMessage({
      payload: msg,
    });
  }

  // const receiveMessage = useCallback(
  //   (receiver, reason = "") => {
  //     let on_message_handler = (message) => {
  //       let content = message.payload.payload;
  //       console.log(
  //         "Message received " + receiver + " " + reason + ": " + content
  //       );
  //       history.push({ pathname: content });
  //     };
  //     if (once === 0) {
  //       zoomSdk.addEventListener("onMessage", on_message_handler);
  //       once = 1;
  //     }
  //   },
  //   [history]
  // );

  useEffect(() => {
    async function connectInstances() {
      // only can call connect when in-meeting
      if (runningContext === "inMeeting") {
        zoomSdk.addEventListener("onConnect", (event) => {
          console.log("Connected");
          setConnected(true);

          // PRE-MEETING
          // first message to send after connecting instances is for the meeting
          // instance to catch up with the client instance
          if (preMeeting === true) {
            console.log("Letting client know meeting instance exists.");
            sendMessage("connected", "meeting");
            console.log("Adding message listener for client's current state.");
            let on_message_handler_mtg = (message) => {
              console.log(
                "Message from client received. Meeting instance updating its state:",
                message.payload.payload
              );
              window.location.replace(message.payload.payload);
              zoomSdk.removeEventListener("onMessage", on_message_handler_mtg);
              setPreMeeting(false); // meeting instance is finished with pre-meeting
            };
            zoomSdk.addEventListener("onMessage", on_message_handler_mtg);
          }
        });

        await zoomSdk.connect();
        console.log("Connecting...");
      }
    }

    if (connected === false) {
      console.log(runningContext, location.pathname);
      connectInstances();
    }
  }, [connected, location.pathname, preMeeting, runningContext]);

  // POST-MEETING
  useEffect(() => {
    async function communicateTabChange() {
      // only proceed with post-meeting after pre-meeting is done
      // just one-way communication from in-meeting to client
      if (runningContext === "inMeeting" && connected && preMeeting === false) {
        sendMessage(location.pathname, runningContext);
      } else if (runningContext === "inMainClient" && preMeeting === false) {
        // receiveMessage(runningContext, "for tab change");
        console.log("something is here")
      }
    }
    communicateTabChange();
  }, [connected, location, preMeeting, runningContext]);

  const {
    inputRef,
    tasks,
    setTasks,
    alert,
    showAlert,
    isEditing,
    setIsEditing,
    editId,
    setEditId,
    name,
    setName,
    filter,
    setFilter,
    isColorsOpen,
    setIsColorsOpen,
  } = useGlobalContext();

  const addTask = (e) => {
    e.preventDefault();
    if (!name) {
      showAlert(true, "Invalid Task Name!");
    } else if (name && isEditing) {
      setTasks(
        tasks.map((task) => {
          return task.id === editId ? { ...task, name: name } : task;
        })
      );
      setIsEditing(false);
      setEditId(null);
      setName("");
      showAlert(true, "Task Edited.");
    } else {
      const newTask = {
        id: uuid().slice(0, 8),
        name: name,
        completed: false,
        color: "#009688",
      };
      setTasks([...tasks, newTask]);
      showAlert(true, "Task Added.");
      setName("");
    }
  };

  const filterTasks = (e) => {
    setFilter(e.target.dataset["filter"]);
  };

  const deleteAll = () => {
    setTasks([]);
    showAlert(true, "Your list is clear!");
  };

  useEffect(() => {
    inputRef.current.focus();
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [inputRef, tasks]);

  const handleDragEnd = (param) => {
    const srcI = param.source.index;
    const desI = param.destination?.index;
    if (desI) {
      const reOrdered = [...tasks];
      reOrdered.splice(desI, 0, reOrdered.splice(srcI, 1)[0]);
      setTasks(reOrdered);
    }
  };

  const hideColorsContainer = (e) => {
    //   body.
    if (e.target.classList.contains("btn-colors")) return;
    setIsColorsOpen(false);
  };

  if (error) {
    console.log(error);
    return (
      <div className="App">
        <h1>{error.message}</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Hello{user ? ` ${user.first_name} ${user.last_name}` : " Zoom Apps user"}!</h1>
      <p>{`User Context Status: ${userContextStatus}`}</p>
      <p>
        {runningContext ?
          `Running Context: ${runningContext}` :
          "Configuring Zoom JavaScript SDK..."
        }
      </p>
      <div className='container' id="meetingSDKElement" onClick={hideColorsContainer}>
        {isColorsOpen && <Colors />}
        {alert && <Alert msg={alert.msg} />}
        <form className='head' onSubmit={addTask}>
          <input
            type='text'
            ref={inputRef}
            placeholder='New Task'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type='submit'>{isEditing ? "Edit" : "Add"}</button>
        </form>
        <div className='filter'>
          <button
            data-filter='all'
            className={filter === "all" ? "active" : ""}
            onClick={filterTasks}
          >
            All
          </button>
          <button
            data-filter='completed'
            className={filter === "completed" ? "active" : ""}
            onClick={filterTasks}
          >
            Completed
          </button>
          <button
            data-filter='uncompleted'
            className={filter === "uncompleted" ? "active" : ""}
            onClick={filterTasks}
          >
            Uncompleted
          </button>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          {tasks.length > 0 ? (
            <List />
          ) : (
            <p className='no-tasks'>Your list is clear!</p>
          )}
        </DragDropContext>
        {tasks.length > 2 && (
          <button
            className='btn-delete-all'
            onClick={deleteAll}
            title='Delete All Tasks (Completed and Uncompleted)!'
          >
            Clear All
          </button>
        )}
        {/* <DarkModeToggle /> */}
      </div>
      <Authorization
        handleError={setError}
        handleUserContextStatus={setUserContextStatus}
        handleUser={setUser}
        user={user}
        userContextStatus={userContextStatus}
      />


      <Routes>
        <Route path="" element={<UserInfo />}> </Route>
        <Route path="/userinfo" element={<UserInfo />} />
        <Route path="/image" element={<Image />} />
        <Route path="/iframe" element={<IFrame />} />

      </Routes>
    </div>
  );
}

export default App;
