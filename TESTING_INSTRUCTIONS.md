# 🧪 Testing Instructions - Collaborative Canvas

## 🌐 Live Demo
**URL**: [https://collaborative-canvas-mnpy.onrender.com/](https://collaborative-canvas-mnpy.onrender.com/)

**Note**: First load may take 30-60 seconds as Render spins up the free tier server.

---

##  Quick Test (2 minutes)

### **Test 1: Multi-User Drawing**
1. **Open the demo link** in your browser
2. **Open a second tab/window** with the same link 
3. **Draw in one window** → Should appear instantly in the other
4. **Success**: Real-time sync working! ✨

### **Test 2: User Management**
1. Check the **user count** in header (should show "2 users online")
2. Look at **"Active Users"** sidebar:

### **Test 3: Tools**
1. **Select eraser** (E key or button)
2. **Draw over existing lines** → Should erase them
3. **Change brush size** 
4. **Change colors** → Draw in different colors


### **Test 4: Global Undo/Redo**
1. **Window 1**: Draw a red line
2. **Window 2**: Draw a blue line
3. **Window 1**: Press Ctrl+Z (undo)
   - Red line disappears in BOTH windows
4. **Window 2**: Press Ctrl+Z (undo)
   - Blue line disappears in BOTH windows
5. **Window 1**: Press Ctrl+Y (redo)
   - Red line reappears in BOTH windows


---

## 🔬 Detailed Testing (10 minutes)

### **Test 5: Multiple Users (3+)**
1. Open **3-5 browser windows/tabs**
2. Each should get a **unique color** and name
3. **Draw simultaneously** in all windows
4. All drawings should sync in **real-time**
5. **Expected**: No lag, smooth synchronization


### **Test 6: Clear Canvas**
1. Have **multiple users** draw various things
2. **One user** clicks "Clear" button
3. **Confirm** the dialog
4. **Expected**: Canvas clears in ALL windows simultaneously

### **Test 7: User Disconnect**
1. **Open 3 windows**
2. **Close one window**
3. **Remaining windows** should:
   - Update user count (2 users online)
   - Remove user from "Active Users" list
   - Remove their cursor
4. **Expected**: Clean disconnect handling

