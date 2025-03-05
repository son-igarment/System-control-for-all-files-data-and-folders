import { useContext, useEffect, useMemo, useRef, useState } from "react";
import Dialog from "./component/Dialog";
import FileList from "./component/FileList";
import LoginForm from "./component/LoginForm";
import Progress from "./component/Progress";
import PropertiesModal from "./component/PropertiesModal";
import Sidebar from "./component/Sidebar";
import Toolbar from "./component/Toolbar";
import { SpaceContext } from "./SpaceContext";
import { uploadFile } from "./utils/file";
import message from "./utils/message";
import service from "./utils/request";

import "nprogress/nprogress.css";
import "./App.css";
import { resolvePermissions } from "./utils/permissions";

// spaces is a list of object { id:, caption:, class: }
// path is a list of object ( id:, name: ) where the first id in the first element is
// the space id.

function App() {
	const { coolApps,isLogin, setIsLogin } = useContext(SpaceContext)

	const [spaces, setSpaces] = useState([]);
	const [path, setPath] = useState([]);	
	const [loading, setLoading] = useState(false);
	const [fileList, setFileList] = useState([]);
	const [sortOrder, setSortOrder] = useState({ field: 'Name', order: 'asc' });
	const [selectedItems, setSelectedItems] = useState({});
	const [uploadList, setUploadList] = useState({})
  const [isPropertiesModalVisible,setIsPropertiesModalVisible] = useState(false)
  const [isExistModalVisible,setIsExistModalVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState({});
  const [view, setView] = useState("list");
  const [currentFiles, setCurrentFiles] = useState([]);
  const resolvedPermissions = useMemo(() => resolvePermissions(selectedItems), [selectedItems]);


  const uploadListRef = useRef({})

	const extensions = useMemo(() => {
		const allExtensions = ['txt'];
		for (const key in coolApps) {
			if (coolApps.hasOwnProperty(key) && coolApps[key].extensions) {
				allExtensions.push(...coolApps[key].extensions);
			}
		}
		return allExtensions;
	}, [coolApps]);

	// what is this, this is not very useful, more like a set of utilities
	const spaceInfo = useMemo(
		() => {
			const space_id = path[0]?.id || "";
			const folder_id = path.length > 1 ? path[path.length - 1]?.id : "";
			const current_id = path[path.length - 1]?.id;
			return { space_id, folder_id, current_id };
		}, [path]
	);

    function login(username, password) {
        service.post(
            "/signin", {username, password,}
        ).then (
            () => {
                sessionStorage.setItem("loginState", 1);
                setIsLogin(true);
            }
        ).catch (
            (error) => { message("error",error); }
        );
    };

    function logout() {
        service.get("/signout").then(() => {
            sessionStorage.clear();
            window.location.reload();
            setIsLogin(false);
        });
    }

	async function getSpaces() {
		setLoading(true);
		try {			
			const rawSpacesData = await service.get("/filer/space"); // return list of (space_id, space_name, space_class)
			if (Array.isArray(!rawSpacesData)) return;
			const filteredSpaces = rawSpacesData
				.filter(space => space[2] !== "share")
				.map(space => ({
					id: space[0],
					caption: space[1],
					class: space[2]
				}))
			filteredSpaces.push(
				{ id: "favour", caption: "Favour", class: "special" },
				{ id: "search", caption: "Search", class: "special" },
				{ id: "recent", caption: "Recent", class: "special" },
				{ id: "trash", caption: "Trash", class: "special" },
			)
			setSpaces(filteredSpaces);
			sessionStorage.setItem('spaces', JSON.stringify(filteredSpaces))
			await switchSpace(filteredSpaces[0]);
		} catch (error) {
			message("error", error);
		}
		setLoading(false);
	}

	function sortItems(items) {
		const sortedItems = [...items];

		sortedItems.sort((a, b) => {
		  if (a.is_folder && !b.is_folder) {
			return -1;
		  }
		  if (!a.is_folder && b.is_folder) {
			return 1;
		  }
		  let x = 0;
		  if (sortOrder.field === "Name") {
			x = a.item_name.localeCompare(b.item_name);
		  } else {
			x = a.modified_time.localeCompare(b.modified_time);
		  };
		  return sortOrder.order === "asc" ? x : -x;
		});
		return sortedItems;
	}

	// Helper function to generate random permissions
	function generateRandomPermissions(item, spaceId) {
		return {
			readable: true, // 100% chance of being readable
			writable: item.space_id === spaceId  // true if the file or folder was created in the current user's pace
		};
	}

	async function fetchFileList(id) {
		try {
			const data = await service.get("/filer/list/" + id);
			const sortedData = sortItems(data)

			// Generate random permissions for each fetched item temporarily 
			return sortedData.map(item => ({
				...item,
				permissions: generateRandomPermissions(item, id)
			}))

			// return sortedData;
		} catch (error) {
			message("error", error);
		}
	}

	async function switchSpace(space) {
		try {
			const fileData = await fetchFileList(space.id);
			setPath([{ name: space.caption, id: space.id }]);
			setFileList(fileData || []);
		} catch (error) {
			message("error", error);
		}
	};

	async function getFileList(id) {
		setLoading(true);
		try {
			const data = await fetchFileList(id);
			setFileList(data);
			setLoading(false);
		} catch (error) {
			message("error", error);
		}
	};

	function openFolder(card) {
		const { item_id, item_name } = card;
		getFileList(item_id);
		if(item_id === spaceInfo.space_id) {
			setPath([{id: item_id, name: item_name,},]);
		} else {
			setPath([...path, {id: item_id, name: item_name,},]);
		}    
	};
  


	async function upload(file, action = '') {
        const fileKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        setUploadList(prevUploadList => ({
            ...prevUploadList,
            [fileKey]: {
                value: '0%',
                status: 'pending',
                name: file.name
            }
        }));
    
        message("loading", "Uploading now");
        try {
            await uploadFile(file, spaceInfo, (value, cancelToken, id) => {
                setUploadList(prevUploadList =>  {
                    const result = {...prevUploadList,
                      [fileKey]: {
                          value,
                          status: 'pending',
                          name: file.name,
                          cancelToken,
                          id
                      }}
                    uploadListRef.current = result
                    
                    return result
                });
            }, action);
            
            await getFileList(spaceInfo.current_id);

            message("success", "Upload successfully");
    
        } catch (error) {
            message("error", error);
        }
    };
    useEffect(() => {
      const list = {...uploadListRef.current}
      Object.keys(list).forEach(key => {
        if(list[key].value === '100%') {
          delete list[key]
        }
      })
      setTimeout(() => {
        if(Object.keys(list).length !== Object.keys(uploadListRef.current).length) {
          setUploadList(list)
        }
      }, 1000);
    }, [uploadListRef.current]);


	async function handleItemClick(card) {
		const { item_id, is_folder, item_name, permissions } = card;

		let selectedItemsCopy = { ...selectedItems };
		if (item_id in selectedItems) {
			delete selectedItemsCopy[item_id];
		} else {
			selectedItemsCopy[item_id] = { is_folder, item_name, permissions };
		}
		setSelectedItems(selectedItemsCopy);
	};
  console.log(spaceInfo);
  
  async function checkExists(file) {
    // const result = fileList.some(item => item.item_name === file.name)
    // if(result) {
    //   setIsExistModalVisible(true)
    //   setCurrentFiles((prevFiles) => [...prevFiles, file])
    // }
    // return result
    try {
      const {exists} = await service.post('/filer/check_file_existence', {
        "folder_id": spaceInfo.folder_id || spaceInfo.space_id,
        "file_name": file.name,
        "file_type": "."  
      })
      if(exists) {
        setIsExistModalVisible(true)
        setCurrentFiles((prevFiles) => [...prevFiles, file])
      }
      return exists
    } catch (error) {
      return false
    }
  }

  async function replaceFile(replace = true) {
    const filesSlice = [...currentFiles];
    filesSlice.shift();
    setCurrentFiles(filesSlice);

    if (filesSlice.length === 0) {
        setIsExistModalVisible(false);
    }

    if (replace) {
      await upload(currentFiles[0], 'replace');
    } else {
      await upload(currentFiles[0]);
    }

  }

  async function continueUpload() {
    replaceFile(false)
  }


	async function handleFileDrop(e) {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (files) {
            for (var i = 0; i < files.length; i++) {
                const result = checkExists(files[i])
                if(!result) {
                  upload(files[i])
                }
            }
		}
	};

	useEffect(() => {
		const loginState = sessionStorage.getItem("loginState");
		if (loginState === "1") {
			setIsLogin(true);
		}
	}, []);

	useEffect(() => {
		if (isLogin) {
            const sessionSpaces = sessionStorage.getItem("spaces")
            const sessionPath = sessionStorage.getItem("path")
            if(sessionSpaces) {
                const spaceParse = JSON.parse(sessionSpaces)
                setSpaces(spaceParse)
                const pathParse = JSON.parse(sessionPath)
                const currentLocation = pathParse[pathParse.length - 1]
                if(['search','trash','recent'].includes(currentLocation.id)) {
                    switchSpace(currentLocation)
                } else {
                    setPath(pathParse)
                    getFileList(currentLocation.id)
                }
            } else {
                getSpaces();
            }
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLogin]);

  useEffect(() => {
    const historyView = localStorage.getItem('view') || 'list'
    setView(historyView)
  }, []);

	useEffect(() => {
		setSelectedItems({});
	}, [path]);

	useEffect(() => {
		const data = sortItems(fileList)
		setFileList(data)
	 // eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sortOrder]);

    useEffect(() => {
        if(path?.length === 0) return
        sessionStorage.setItem("path",JSON.stringify(path))
    }, [path]);

	return (
		<div className="App flex">
			<Sidebar spaces={spaces} path={path} switchSpace={switchSpace} spaceInfo={spaceInfo}/>
			<div className="w-56 hidden sm:block">
			</div>
			{!isLogin && 
				<LoginForm doLogin={login} />
			}
			<div className="flex-1 px-4 pb-4 h-screen" 
				onDrop={handleFileDrop}
				onDragOver={(e) => e.preventDefault()}
				onDragEnter={(e) => e.preventDefault()}>
				<Toolbar
					spaces={spaces}
					path={path}
					setPath={setPath}
					fileList={fileList}
					setFileList={setFileList}
					spaceInfo={spaceInfo}
					handleLogout={logout}
					getFileList={getFileList}
					selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
					openFolder={openFolder}
					sortOrder={sortOrder}
					setSortOrder={setSortOrder}
          upload={upload}
          view={view}
          setView={setView}
          checkExists={checkExists}
		  resolvedPermissions={resolvedPermissions}
				/>
				<div className={` pb-4 box-border mt-[96px] pl-[2px] pr-[2px] ${view === 'grid' ? "flex flex-wrap gap-5" : "space-y-4"}`}>
          {!loading && (
						<FileList
							openFolder={openFolder}
							fileList={fileList}
							extensions={extensions}
							handleItemClick={handleItemClick}
							spaceInfo={spaceInfo}
							getFileList={getFileList}
							setPath={setPath}
              setIsPropertiesModalVisible={setIsPropertiesModalVisible}
              setCurrentItem={setCurrentItem}
              view={view}
					    selectedItems={selectedItems}
						/>
					)}
					{!loading && path.length > 0 && fileList?.length === 0 && (
						<div className=" flex items-center text-zinc-700">
							There are no files in the current directory.
						</div>
					)}
				</div>
			</div>
      {useMemo(() => <Progress spaceInfo={spaceInfo} getFileList={getFileList} uploadList={uploadList} setUploadList={setUploadList} />, [uploadList])}
      {isExistModalVisible && <Dialog 
      title={() => <div>
        The <span className="text-zinc-800">{currentFiles[0]?.name}</span> already exists. Do you want to replace it?
      </div>}
      confirmButtonColor="bg-[#ffa270]" onConfirm={replaceFile} onCancel={continueUpload} confirmText="Replace it" cancelText="No, just upload" />}
      {isPropertiesModalVisible && <PropertiesModal setCurrentItem={setCurrentItem} getFileList={getFileList} spaceInfo={spaceInfo} setIsPropertiesModalVisible={setIsPropertiesModalVisible} itemInfo={currentItem} permissions={resolvedPermissions} />}
		</div>
	);
}

export default App;

