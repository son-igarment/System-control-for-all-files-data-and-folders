import React, { createContext, useState, useEffect } from "react";
import service from "./utils/request";

export const SpaceContext = createContext(null);

export const SpaceProvider = ({ children }) => {
    const [users, setUsers] = useState([]);
    const [coolApps, setCoolApps] = useState([]);
    const [isLogin, setIsLogin] = useState(false);


    useEffect(() => {
        const data = localStorage.getItem("collab_apps");
        if (data) {
            setCoolApps(JSON.parse(data));
        } else {
            service
                .get("/filer/discovery")
                .then((res) => {
                    localStorage.setItem("collab_apps", JSON.stringify(res));
                    setCoolApps(res);
                })
                .catch((error) => {
                    console.error("Error fetching cool apps:", error);
                });
        }
    }, []);

    useEffect(() => {
      if(isLogin) {
        service.get("/filer/users").then((res) => setUsers(res));
      }
        
    }, [isLogin]);

    return (
        <SpaceContext.Provider value={{ coolApps, users, isLogin, setIsLogin }}>
            {children}
        </SpaceContext.Provider>
    );
};
