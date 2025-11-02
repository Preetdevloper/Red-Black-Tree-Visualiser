// rb_tree.js

// Global variable for autoplay control
let fixupInterval = null;

// --- Core Node and Tree Classes ---
class RBNode {
    constructor(value) {
        this.value = value;
        this.color = 'RED';
        this.left = null;
        this.right = null;
        this.parent = null;
        this.x = 0; 
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
    }

    getSnapshot() {
        return {
            value: this.value,
            color: this.color,
            left: this.left ? this.left.getSnapshot() : null,
            right: this.right ? this.right.getSnapshot() : null,
            x: this.x,
            y: this.y,
            targetX: this.targetX,
            targetY: this.targetY,
        };
    }
}

class RedBlackTree {
    constructor() {
        this.root = null;
        this.history = []; 
        this.currentStepIndex = -1; 
        this.nodeToFix = null; 
        this.fixupInProgress = false;
        this.fixupType = null;
    }
    
    buildTreeFromSnapshot(snapshot, parent = null) {
        if (!snapshot) return null;

        const node = new RBNode(snapshot.value);
        node.color = snapshot.color;
        node.parent = parent;
        
        // Initialize x, y to the target coordinates to ensure the node is visible immediately.
        node.targetX = snapshot.targetX || 0;
        node.targetY = snapshot.targetY || 0;
        node.x = node.targetX; 
        node.y = node.targetY;
        
        node.left = this.buildTreeFromSnapshot(snapshot.left, node);
        node.right = this.buildTreeFromSnapshot(snapshot.right, node);

        return node;
    }

    saveState(stepMessage) {
        if (this.currentStepIndex !== this.history.length - 1) {
            this.history.splice(this.currentStepIndex + 1);
        }

        // Call calculatePositions immediately before saving to ensure x,y,targetX,targetY are accurate
        calculateLevels(this.root);
        calculatePositions(this.root, canvas.width); 
        
        const treeSnapshot = this.root ? this.root.getSnapshot() : null;
        this.history.push({
            rootSnapshot: treeSnapshot,
            stepMessage: stepMessage,
        });
        this.currentStepIndex = this.history.length - 1;
    }

    loadState(index) {
        if (fixupInterval) clearInterval(fixupInterval);
        this.fixupInProgress = false;
        
        if (index < 0 || index >= this.history.length) return false;

        const { rootSnapshot } = this.history[index];

        this.root = this.buildTreeFromSnapshot(rootSnapshot);
        this.currentStepIndex = index;
        
        this.updateDisplay();
        return true;
    }
    
    updateDisplay(scrollToBottom = false) {
         document.getElementById('treeHeight').textContent = this.getHeight();
         document.getElementById('nodeCount').textContent = this.countNodes(this.root);
         
         const bh = this.getBlackHeight(this.root);
         document.getElementById('blackHeight').textContent = (bh === 'ERROR' ? 'INVALID' : bh);
    
         const stepsDisplay = document.getElementById('stepsDisplay');
         
         const historySteps = this.history.map((h, index) => {
             const step = h.stepMessage;
             const isViolation = step.toLowerCase().includes('case') || step.toLowerCase().includes('fix-up') || step.toLowerCase().includes('recolor') || step.toLowerCase().includes('rotate');
             const isActive = index === this.currentStepIndex ? 'active' : '';
             return `<div class="step-item ${isViolation ? 'violation' : ''} ${isActive}">${step}</div>`;
         }).join('');

         if (historySteps.length === 0) {
              stepsDisplay.innerHTML = `<div style="color: var(--text-secondary);">Waiting for operation...</div>`;
         } else {
              stepsDisplay.innerHTML = historySteps;
         }
    
         if (scrollToBottom) {
              stepsDisplay.scrollTop = stepsDisplay.scrollHeight;
         }
    
         animateTree();
    }

    // --- RB Tree Utility Methods ---
    countNodes(node) {
        if (!node) return 0;
        return 1 + this.countNodes(node.left) + this.countNodes(node.right);
    }

    getHeight(node = this.root) {
        if (!node) return 0;
        return 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
    }

    getBlackHeight(node) {
        if (!node) return 1; 
        const leftBH = this.getBlackHeight(node.left);
        const rightBH = this.getBlackHeight(node.right);
        
        if (leftBH === 'ERROR' || rightBH === 'ERROR' || leftBH !== rightBH) {
            return 'ERROR';
        }
        
        const bh = leftBH + (node.color === 'BLACK' ? 1 : 0);
        return bh;
    }

    // --- Rotation Helpers (Unchanged) ---
    rotateLeft(node) {
        const rightChild = node.right;
        node.right = rightChild.left;
        if (rightChild.left) { rightChild.left.parent = node; }
        rightChild.parent = node.parent;
        if (!node.parent) { this.root = rightChild; } 
        else if (node === node.parent.left) { node.parent.left = rightChild; } 
        else { node.parent.right = rightChild; }
        rightChild.left = node;
        node.parent = rightChild;
    }

    rotateRight(node) {
        const leftChild = node.left;
        node.left = leftChild.right;
        if (leftChild.right) { leftChild.right.parent = node; }
        leftChild.parent = node.parent;
        if (!node.parent) { this.root = leftChild; } 
        else if (node === node.parent.right) { node.parent.right = leftChild; } 
        else { node.parent.left = leftChild; }
        leftChild.right = node;
        node.parent = leftChild;
    }
    
    // --- Insertion Logic ---
    insert(value) {
        this.history = []; 
        this.fixupType = 'insert';
        this.saveState(`Starting insert for: ${value}`);

        const newNode = new RBNode(value);
        this.nodeToFix = newNode;

        if (!this.root) {
            this.root = newNode;
            this.root.color = 'BLACK';
            this.saveState(`Root: ${newNode.value} inserted as BLACK. Fix-up complete.`);
            
            drawTree(); 
            this.nodeToFix = null;
            return;
        }

        let current = this.root;
        let parent = null;

        while (current) {
            parent = current;
            if (value < current.value) {
                current = current.left;
            } else if (value > current.value) {
                current = current.right;
            } else {
                this.saveState('Value already exists in tree (No change)');
                this.nodeToFix = null;
                return;
            }
        }

        newNode.parent = parent;
        if (value < parent.value) {
            parent.left = newNode;
        } else {
            parent.right = newNode;
        }
        
        this.saveState(`Inserted ${value} as RED node (z). Starting fix-up.`);
        
        // AUTOPLAY START
        setTimeout(() => {
            fixupInterval = setInterval(() => {
                if (this.fixupInProgress || !animationComplete) return; 

                this.fixupInProgress = true;
                if (!this.runFixStep()) {
                    clearInterval(fixupInterval);
                    fixupInterval = null;
                }
                this.fixupInProgress = false;
            }, 500); 
        }, 100); 
    }

    // --- Deletion Logic ---
    delete(value) {
        this.history = [];
        this.fixupType = 'delete';
        this.saveState(`Starting delete for: ${value}`);
        
        const z = this.search(this.root, value);
        if (!z) {
            this.saveState('Value not found in tree (No change)');
            this.nodeToFix = null;
            return;
        }
        
        let y = z;
        let yOriginalColor = y.color;
        let xParent = null; 
        let xSide = null;

        if (!z.left) {
            xParent = z.parent;
            xSide = (z === z.parent?.left) ? 'left' : 'right';
            this.saveState(`Pre-Delete: Node ${z.value} has no left child. Replacing with right child.`);
            this.transplant(z, z.right);
        } else if (!z.right) {
            xParent = z.parent;
            xSide = (z === z.parent?.left) ? 'left' : 'right';
            this.saveState(`Pre-Delete: Node ${z.value} has no right child. Replacing with left child.`);
            this.transplant(z, z.left);
        } else {
            y = this.minimum(z.right);
            yOriginalColor = y.color;
            xParent = y.parent;
            xSide = 'right';

            this.saveState(`Pre-Delete: Successor ${y.value} found.`);

            if (y.parent !== z) {
                this.saveState(`Pre-Delete: Transplanting ${y.value}'s right child to fill successor hole.`);
                this.transplant(y, y.right);
                y.right = z.right;
                if (y.right) y.right.parent = y;
            }
            
            this.saveState(`Pre-Delete: Transplanting ${z.value} with successor ${y.value}.`);
            this.transplant(z, y);
            y.left = z.left;
            y.left.parent = y;
            y.color = z.color;
        }
        
        if (yOriginalColor === 'BLACK') {
            const nilPlaceholder = { 
                value: 'NIL', 
                color: 'BLACK', 
                parent: xParent,
                isLeft: xSide === 'left',
                isPlaceholder: true 
            };
            
            this.nodeToFix = nilPlaceholder;
            this.saveState(`Deleted BLACK node. Starting double-black fix-up on parent ${xParent ? xParent.value : 'root'}.`);
            
            setTimeout(() => {
                fixupInterval = setInterval(() => {
                    if (this.fixupInProgress || !animationComplete) return; 

                    this.fixupInProgress = true;
                    if (!this.runFixStep()) {
                        clearInterval(fixupInterval);
                        fixupInterval = null;
                    }
                    this.fixupInProgress = false;
                }, 500); 
            }, 100);
        } else {
            this.nodeToFix = null;
            this.saveState(`Deleted RED node ${z.value}. Fix-up complete.`);
        }
    }
    
    transplant(u, v) {
        if (!u.parent) { this.root = v; } 
        else if (u === u.parent.left) { u.parent.left = v; } 
        else { u.parent.right = v; }
        if (v && !v.isPlaceholder) v.parent = u.parent;
    }

    // --- Universal Fix-up Dispatcher (Unchanged) ---
    runFixStep() {
        if (!this.nodeToFix) return false;
        
        if (this.fixupType === 'insert') {
            return this.fixInsertStep();
        } else if (this.fixupType === 'delete') {
            return this.fixDeleteStep();
        }
        return false;
    }

    // --- Step-by-Step Fix Insert (Core Logic) ---
    fixInsertStep() {
        if (!this.nodeToFix) return false;
        let node = this.search(this.root, this.nodeToFix.value) || this.nodeToFix; 
        
        if (!node || !node.parent || node.parent.color === 'BLACK') {
            
            if (this.root && this.root.color === 'RED') {
                this.root.color = 'BLACK';
                this.saveState('Final: Root recolored BLACK. Fix-up complete.');
            } else {
                this.saveState(`Property 4 satisfied. Fix-up complete.`);
            }

            this.nodeToFix = null;
            this.updateDisplay();
            return false;
        }

        if (node.parent.color === 'RED') {
            if (!node.parent.parent) return false; 

            const grandparent = node.parent.parent;
            const isParentLeft = node.parent === grandparent.left;
            const uncle = isParentLeft ? grandparent.right : grandparent.left;

            if (uncle && uncle.color === 'RED') {
                // Case 1
                node.parent.color = 'BLACK';
                if (uncle) uncle.color = 'BLACK';
                grandparent.color = 'RED';
                this.nodeToFix = grandparent;
                this.saveState(`
Case 1: Parent and Uncle are RED.
1. Recolor parent $\leftarrow$ BLACK.
2. Recolor uncle $\leftarrow$ BLACK.
3. Recolor grandparent $\leftarrow$ RED.
4. Set $z \leftarrow$ grandparent.
`);
                this.updateDisplay();
                return true;

            } else { // Uncle is BLACK or null
                if (isParentLeft && node === node.parent.right) {
                    // Case 2 (Left-Right/Triangle case)
                    this.rotateLeft(node.parent); 
                    this.nodeToFix = node.left; 
                    this.saveState(`
Case 2 (Left-Right): Parent is RED, Uncle is BLACK, $z$ is inner child.
1. Left-Rotate on parent (z.p).
2. Set $z \leftarrow$ former parent.
`);
                    node = this.search(this.root, this.nodeToFix.value) || this.nodeToFix; 
                } else if (!isParentLeft && node === node.parent.left) {
                     // Case 2 (Right-Left/Triangle case)
                    this.rotateRight(node.parent);
                    this.nodeToFix = node.right;
                    this.saveState(`
Case 2 (Right-Left): Parent is RED, Uncle is BLACK, $z$ is inner child.
1. Right-Rotate on parent (z.p).
2. Set $z \leftarrow$ former parent.
`);
                    node = this.search(this.root, this.nodeToFix.value) || this.nodeToFix;
                }
                
                // Case 3 (Line case, or fall-through from Case 2)
                node.parent.color = 'BLACK';
                node.parent.parent.color = 'RED';
                
                if (node.parent === node.parent.parent.left) {
                    this.rotateRight(node.parent.parent); 
                    this.saveState(`
Case 3 (Left-Left): Parent is RED, Uncle is BLACK, $z$ is outer child.
1. Recolor parent $\leftarrow$ BLACK.
2. Recolor grandparent $\leftarrow$ RED.
3. Right-Rotate on grandparent (z.p.p).
4. Fix-up complete.
`);
                } else {
                    this.rotateLeft(node.parent.parent); 
                    this.saveState(`
Case 3 (Right-Right): Parent is RED, Uncle is BLACK, $z$ is outer child.
1. Recolor parent $\leftarrow$ BLACK.
2. Recolor grandparent $\leftarrow$ RED.
3. Left-Rotate on grandparent (z.p.p).
4. Fix-up complete.
`);
                }

                this.nodeToFix = null;
                this.updateDisplay();
                return false;
            }
        }
        
        return false;
    }
    
    // --- Step-by-Step Fix Delete (Core Logic) ---
    fixDeleteStep() {
        if (!this.nodeToFix) return false;
        
        let x = this.search(this.root, this.nodeToFix.value) || this.nodeToFix; 
        let parent = x.parent || this.nodeToFix.parent;
        
        if (x === this.root || !parent) { 
            if (this.root.color === 'RED') this.root.color = 'BLACK';
            this.nodeToFix = null;
            this.saveState(`Fix-up complete: Reached root. Final root color is BLACK.`);
            this.updateDisplay();
            return false;
        }

        const isXLeft = parent.left === x || (x.isPlaceholder && x.isLeft);
        let sibling = isXLeft ? parent.right : parent.left;
        
        if (!sibling) { this.nodeToFix = null; return false; }

        // Case 1: Sibling is RED
        if (sibling.color === 'RED') {
            sibling.color = 'BLACK';
            parent.color = 'RED';
            if (isXLeft) {
                this.rotateLeft(parent);
                this.saveState(`
Case 1: Sibling (w) is RED.
1. Recolor w $\leftarrow$ BLACK.
2. Recolor p $\leftarrow$ RED.
3. LEFT-ROTATE(T, p).
4. New sibling found. Repeat fixup.
`);
            } else {
                this.rotateRight(parent);
                this.saveState(`
Case 1: Sibling (w) is RED.
1. Recolor w $\leftarrow$ BLACK.
2. Recolor p $\leftarrow$ RED.
3. RIGHT-ROTATE(T, p).
4. New sibling found. Repeat fixup.
`);
            }
            this.updateDisplay();
            return true;
        }

        // Sibling is BLACK from here on.
        let sLeft = sibling.left;
        let sRight = sibling.right;

        // Case 2: Sibling is BLACK, both children are BLACK
        if ((!sLeft || sLeft.color === 'BLACK') && (!sRight || sRight.color === 'BLACK')) {
            sibling.color = 'RED';
            
            if (parent.color === 'RED') {
                parent.color = 'BLACK';
                this.nodeToFix = null; 
                this.saveState(`
Case 2: Sibling (w) and children are BLACK. Parent is RED.
1. Recolor w $\leftarrow$ RED.
2. Recolor p $\leftarrow$ BLACK.
3. Fix-up complete.
`);
                this.updateDisplay();
                return false;
            } else {
                this.nodeToFix = parent; 
                this.saveState(`
Case 2: Sibling (w) and children are BLACK. Parent is BLACK.
1. Recolor w $\leftarrow$ RED.
2. Propagate double-black to parent ($x \leftarrow p$).
`);
                this.updateDisplay();
                return true; 
            }
        }

        // Case 3: Sibling is BLACK, near child is RED, far child is BLACK
        if (isXLeft && sLeft && sLeft.color === 'RED' && (!sRight || sRight.color === 'BLACK')) {
            sLeft.color = 'BLACK';
            sibling.color = 'RED';
            this.rotateRight(sibling);
            this.saveState(`
Case 3 (L-R): Near child (w.left) is RED.
1. Recolor w.left $\leftarrow$ BLACK, w $\leftarrow$ RED.
2. RIGHT-ROTATE(T, w).
3. Now in Case 4 setup.
`);
            this.updateDisplay();
            return true;
        } else if (!isXLeft && sRight && sRight.color === 'RED' && (!sLeft || sLeft.color === 'BLACK')) {
            sRight.color = 'BLACK';
            sibling.color = 'RED';
            this.rotateLeft(sibling);
            this.saveState(`
Case 3 (R-L): Near child (w.right) is RED.
1. Recolor w.right $\leftarrow$ BLACK, w $\leftarrow$ RED.
2. LEFT-ROTATE(T, w).
3. Now in Case 4 setup.
`);
            this.updateDisplay();
            return true;
        }
        
        // Case 4: Sibling is BLACK, far child is RED (Termination)
        
        // Re-fetch sibling pointers
        sibling = isXLeft ? parent.right : parent.left;
        sLeft = sibling?.left;
        sRight = sibling?.right;

        if (isXLeft) {
            sibling.color = parent.color;
            parent.color = 'BLACK';
            if (sRight) sRight.color = 'BLACK';
            this.rotateLeft(parent);
            this.saveState(`
Case 4 (L-L): Far child (w.right) is RED.
1. Recolor w $\leftarrow$ p.color, p $\leftarrow$ BLACK.
2. Recolor w.right $\leftarrow$ BLACK.
3. LEFT-ROTATE(T, p). Fix-up complete.
`);
        } else {
            sibling.color = parent.color;
            parent.color = 'BLACK';
            if (sLeft) sLeft.color = 'BLACK';
            this.rotateRight(parent);
            this.saveState(`
Case 4 (R-R): Far child (w.left) is RED.
1. Recolor w $\leftarrow$ p.color, p $\leftarrow$ BLACK.
2. Recolor w.left $\leftarrow$ BLACK.
3. RIGHT-ROTATE(T, p). Fix-up complete.
`);
        }

        this.nodeToFix = null;
        this.updateDisplay();
        return false;
    }


    // --- Unchanged structural methods ---
    minimum(node) {
        while (node.left) { node = node.left; }
        return node;
    }

    search(node, value) {
        if (!node || node.value === value) { return node; }
        if (value < node.value) { return this.search(node.left, value); }
        return this.search(node.right, value);
    }
}

const tree = new RedBlackTree();
const canvas = document.getElementById('tree-canvas');
const ctx = canvas.getContext('2d');
let showNullNodes = false;
let animationComplete = true; 

// --- Global Control Functions ---
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    tree.updateDisplay();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function prevStep() {
    if (!animationComplete) return; 
    if (fixupInterval) clearInterval(fixupInterval); 
    tree.loadState(tree.currentStepIndex - 1);
}

function nextStep() {
    if (!animationComplete) return;
    if (fixupInterval) clearInterval(fixupInterval); 
    tree.loadState(tree.currentStepIndex + 1);
}

function runOperation(operationFunc) {
    if (!animationComplete) return;
    if (fixupInterval) clearInterval(fixupInterval); 
    operationFunc();
    tree.updateDisplay(true); 
}

function insertNode() {
    const value = parseInt(document.getElementById('nodeValue').value);
    if (isNaN(value)) {
        alert('Please enter a valid number');
        return;
    }
    runOperation(() => tree.insert(value));
    document.getElementById('nodeValue').value = '';
}

function deleteNode() {
    const value = parseInt(document.getElementById('nodeValue').value);
    if (isNaN(value)) {
        alert('Please enter a valid number');
        return;
    }
    runOperation(() => tree.delete(value));
    document.getElementById('nodeValue').value = '';
}

function clearTree() {
    runOperation(() => {
        tree.root = null;
        tree.saveState('Tree cleared');
        tree.nodeToFix = null;
    });
}

function toggleNullNodes() {
    showNullNodes = !showNullNodes;
    document.getElementById('nullToggle').classList.toggle('active');
    tree.updateDisplay();
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    document.getElementById('themeToggle').classList.toggle('active');
    tree.updateDisplay();
}

// --- Canvas Drawing and Animation Functions ---
function calculateLevels(node) {
    if (!node) return;
    const queue = [{ node: node, level: 0 }];
    while (queue.length > 0) {
        const { node: currentNode, level } = queue.shift();
        currentNode.level = level; 
        if (currentNode.left) queue.push({ node: currentNode.left, level: level + 1 });
        if (currentNode.right) queue.push({ node: currentNode.right, level: level + 1 });
    }
}

function calculatePositions(node, canvasWidth) {
    if (!node) return;

    calculateLevels(node); 

    const levels = new Map();
    let maxLevel = 0;
    const queue = [{ node: node, level: 0 }];
    while (queue.length > 0) {
        const { node: currentNode, level } = queue.shift();
        maxLevel = Math.max(maxLevel, level);
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level).push(currentNode);

        if (currentNode.left) queue.push({ node: currentNode.left, level: level + 1 });
        if (currentNode.right) queue.push({ node: currentNode.right, level: level + 1 });
    }

    let maxSlots = 0;
    for (let level = 0; level <= maxLevel; level++) {
        let currentLevelSlots = 0;
        for (const n of levels.get(level) || []) {
            currentLevelSlots++; 
            if (showNullNodes) {
                if (!n.left) currentLevelSlots++;
                if (!n.right) currentLevelSlots++;
            }
        }
        maxSlots = Math.max(maxSlots, currentLevelSlots);
    }

    if (maxSlots === 0) maxSlots = 1;

    const NODE_RADIUS = 20; 
    const minHorizontalSpacing = NODE_RADIUS * 2 + 30; 
    let totalTreeWidth = maxSlots * minHorizontalSpacing;

    const scaleFactor = Math.min(1, canvasWidth / (totalTreeWidth + minHorizontalSpacing)); 
    const horizontalSpacing = minHorizontalSpacing * scaleFactor;
    
    const startX = (canvasWidth - totalTreeWidth * scaleFactor) / 2 + horizontalSpacing / 2;

    let currentXSlot = 0;
    const horizontalOffsets = new Map();

    function inOrderAssignX(n, level) {
        if (!n) {
            if (showNullNodes) { currentXSlot++; }
            return;
        }
        inOrderAssignX(n.left, level + 1);
        horizontalOffsets.set(n, currentXSlot);
        currentXSlot++;
        inOrderAssignX(n.right, level + 1);
    }
    
    inOrderAssignX(node, 0); 

    const verticalSpacing = Math.min(80, canvas.height / (maxLevel + 2)); 

    const allNodes = [];
    const collectNodes = (n) => {
        if (n) {
            allNodes.push(n);
            collectNodes(n.left);
            collectNodes(n.right);
        }
    };
    collectNodes(node);

    for (const n of allNodes) {
        const assignedSlot = horizontalOffsets.get(n);
        n.targetX = startX + assignedSlot * horizontalSpacing;
        n.targetY = 50 + n.level * verticalSpacing; 
    }
}


function animateTree() {
    if (!tree.root) {
        drawTree();
        return;
    }
    
    animationComplete = false;
    
    calculatePositions(tree.root, canvas.width);

    const animationFactor = 0.15;

    function animate() {
        let allInPlace = true;
        
        function updateNode(node) {
            if (!node) return;
            
            const dx = node.targetX - node.x;
            const dy = node.targetY - node.y;
            
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                node.x += dx * animationFactor;
                node.y += dy * animationFactor;
                allInPlace = false;
            } else {
                node.x = node.targetX;
                node.y = node.targetY;
            }
            
            updateNode(node.left);
            updateNode(node.right);
        }
        
        updateNode(tree.root);
        drawTree();
        
        if (!allInPlace) {
            requestAnimationFrame(animate);
        } else {
            animationComplete = true; 
        }
    }
    
    requestAnimationFrame(animate);
}

function drawTree() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!tree.root) {
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-secondary');
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tree is empty', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    drawConnections(tree.root);
    drawNode(tree.root);
}

function drawConnections(node) {
    if (!node) return;
    
    const styles = getComputedStyle(document.body);
    ctx.strokeStyle = styles.getPropertyValue('--border');
    ctx.lineWidth = 2;
    
    const RADIUS = 20; 
    const verticalSpacing = 80; 

    function getLinkPoints(fromX, fromY, toX, toY, radius) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        return {
            startX: fromX + Math.cos(angle) * radius,
            startY: fromY + Math.sin(angle) * radius,
            endX: toX - Math.cos(angle) * radius,
            endY: toY - Math.sin(angle) * radius,
        };
    }
    
    if (node.left) {
        const points = getLinkPoints(node.x, node.y, node.left.x, node.left.y, RADIUS);
        ctx.beginPath();
        ctx.moveTo(points.startX, points.startY);
        ctx.lineTo(points.endX, points.endY);
        ctx.stroke();
        drawConnections(node.left);
    } else if (showNullNodes) {
        const nullX = node.x - 30;
        const nullY = node.y + verticalSpacing - 20; 
        ctx.beginPath();
        ctx.moveTo(node.x, node.y + RADIUS);
        ctx.lineTo(nullX, nullY);
        ctx.stroke();
        drawNullNode(nullX, nullY);
    }
    
    if (node.right) {
        const points = getLinkPoints(node.x, node.y, node.right.x, node.right.y, RADIUS);
        ctx.beginPath();
        ctx.moveTo(points.startX, points.startY);
        ctx.lineTo(points.endX, points.endY);
        ctx.stroke();
        drawConnections(node.right);
    } else if (showNullNodes) {
        const nullX = node.x + 30;
        const nullY = node.y + verticalSpacing - 20; 
        ctx.beginPath();
        ctx.moveTo(node.x, node.y + RADIUS);
        ctx.lineTo(nullX, nullY);
        ctx.stroke();
        drawNullNode(nullX, nullY);
    }
}

function drawNode(node) {
    if (!node) return;
    
    const radius = 20; // Reduced radius constant for drawing
    const styles = getComputedStyle(document.body);
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color === 'RED' ? 
        styles.getPropertyValue('--red-node') : 
        styles.getPropertyValue('--black-node');
    ctx.fill();
    ctx.strokeStyle = styles.getPropertyValue('--border');
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif'; // Adjusted font size
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.value, node.x, node.y);
    
    drawNode(node.left);
    drawNode(node.right);
}

function drawNullNode(x, y) {
    const radius = 15;
    const styles = getComputedStyle(document.body);
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = styles.getPropertyValue('--null-node');
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x, y);
}

document.getElementById('nodeValue').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        insertNode();
    }
});

// Initial draw
tree.updateDisplay();
