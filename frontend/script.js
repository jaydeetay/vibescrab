document.addEventListener('DOMContentLoaded', () => {
    const BOARD_SIZE = 15;
    const gameBoardElement = document.getElementById('game-board');
    const playerTilesElement = document.getElementById('player-tiles');

    // Represents the state of the game board (e.g., which tiles are where)
    // For now, just an empty 2D array.
    // Later, this could store tile objects or null if empty.
    let boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    // Standard Scrabble tile distribution (English)
    const TILE_DISTRIBUTION = {
        'A': { count: 9, value: 1 }, 'B': { count: 2, value: 3 }, 'C': { count: 2, value: 3 },
        'D': { count: 4, value: 2 }, 'E': { count: 12, value: 1 }, 'F': { count: 2, value: 4 },
        'G': { count: 3, value: 2 }, 'H': { count: 2, value: 4 }, 'I': { count: 9, value: 1 },
        'J': { count: 1, value: 8 }, 'K': { count: 1, value: 5 }, 'L': { count: 4, value: 1 },
        'M': { count: 2, value: 3 }, 'N': { count: 6, value: 1 }, 'O': { count: 8, value: 1 },
        'P': { count: 2, value: 3 }, 'Q': { count: 1, value: 10 }, 'R': { count: 6, value: 1 },
        'S': { count: 4, value: 1 }, 'T': { count: 6, value: 1 }, 'U': { count: 4, value: 1 },
        'V': { count: 2, value: 4 }, 'W': { count: 2, value: 4 }, 'X': { count: 1, value: 8 },
        'Y': { count: 2, value: 4 }, 'Z': { count: 1, value: 10 }, '_': { count: 2, value: 0 } // Blank tiles
    };

    let tileBag = [];

    // Represents the current player's hand/rack of tiles
    // Example: [{letter: 'A', value: 1}, {letter: 'B', value: 3}, ...]
    let playerHand = [];
    const MAX_HAND_SIZE = 7;

    // --- Game Board Rendering ---
    function createBoard() {
        gameBoardElement.innerHTML = ''; // Clear existing board
        for (let i = 0; i < BOARD_SIZE; i++) {
            const row = gameBoardElement.insertRow();
            for (let j = 0; j < BOARD_SIZE; j++) {
                const cell = row.insertCell();
                cell.dataset.row = i;
                cell.dataset.col = j;
                // Add classes for special squares (Scrabble layout)
                // This is a simplified version; a full Scrabble board has a specific pattern.
                // TW: Triple Word, DW: Double Word, TL: Triple Letter, DL: Double Letter
                // Center is often DW or a special start square
                if ((i === 0 || i === 7 || i === 14) && (j === 0 || j === 7 || j === 14) && !(i===7 && j===7)) {
                    if (!((i===0 && j===7) || (i===7 && j===0) || (i===7 && j===14) || (i===14 && j===7))) {
                        cell.classList.add('triple-word');
                        cell.title = "Triple Word Score";
                    }
                }
                if (i === 7 && j === 7) {
                    cell.classList.add('start-square'); // Center square
                    cell.innerHTML = '★'; // Star for the center
                    cell.title = "Start Square / Double Word Score";
                }
                // Simplified DW (corners of a 5x5 box around center and other spots)
                const dwCoordinates = [[1,1], [2,2], [3,3], [4,4], [1,13], [2,12], [3,11], [4,10], [13,1], [12,2], [11,3], [10,4], [13,13], [12,12], [11,11], [10,10]];
                if (dwCoordinates.some(coord => coord[0] === i && coord[1] === j) && !(i === 7 && j === 7)) {
                     cell.classList.add('double-word');
                     cell.title = "Double Word Score";
                }

                // Simplified TL
                const tlCoordinates = [[1,5], [1,9], [5,1], [5,5], [5,9], [5,13], [9,1], [9,5], [9,9], [9,13], [13,5], [13,9]];
                 if (tlCoordinates.some(coord => coord[0] === i && coord[1] === j)) {
                     cell.classList.add('triple-letter');
                     cell.title = "Triple Letter Score";
                 }

                // Simplified DL
                const dlCoordinates = [
                    [0,3], [0,11], [2,6], [2,8], [3,0], [3,7], [3,14], [6,2], [6,6], [6,8], [6,12],
                    [7,3], [7,11], [8,2], [8,6], [8,8], [8,12], [11,0], [11,7], [11,14], [12,6], [12,8],
                    [14,3], [14,11]
                ];
                if (dlCoordinates.some(coord => coord[0] === i && coord[1] === j)) {
                    cell.classList.add('double-letter');
                    cell.title = "Double Letter Score";
                }

                // Later: Add event listeners for dropping tiles here
                cell.addEventListener('dragover', handleDragOver);
                cell.addEventListener('drop', handleDropOnBoard);
                cell.addEventListener('dragleave', handleDragLeaveBoardCell);
                cell.addEventListener('dragenter', handleDragEnterBoardCell);
            }
        }
    }

    // --- Tile Management ---
    function initializeTileBag() {
        tileBag = [];
        for (const letter in TILE_DISTRIBUTION) {
            for (let i = 0; i < TILE_DISTRIBUTION[letter].count; i++) {
                tileBag.push({ letter: letter, value: TILE_DISTRIBUTION[letter].value });
            }
        }
        shuffleTileBag();
    }

    function shuffleTileBag() {
        for (let i = tileBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tileBag[i], tileBag[j]] = [tileBag[j], tileBag[i]]; // Swap
        }
    }

    function drawTiles(numTiles) {
        const drawn = [];
        for (let i = 0; i < numTiles && tileBag.length > 0; i++) {
            drawn.push(tileBag.pop());
        }
        return drawn;
    }

    function refillPlayerHand() {
        const tilesNeeded = MAX_HAND_SIZE - playerHand.length;
        if (tilesNeeded > 0) {
            const newTiles = drawTiles(tilesNeeded);
            playerHand.push(...newTiles);
        }
        renderPlayerHand();
    }

    function renderPlayerHand() {
        playerTilesElement.innerHTML = ''; // Clear existing tiles
        playerHand.forEach((tile, index) => {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('tile');
            tileDiv.textContent = tile.letter === '_' ? '' : tile.letter; // Show blank for blank tile
            if(tile.letter === '_') tileDiv.classList.add('blank-tile'); // Special style for blank

            const valueSpan = document.createElement('span');
            valueSpan.classList.add('letter-value');
            valueSpan.textContent = tile.value;
            tileDiv.appendChild(valueSpan);

            tileDiv.draggable = true;
            tileDiv.dataset.tileIndex = index; // Keep track of its original index in hand
            tileDiv.dataset.letter = tile.letter;
            tileDiv.dataset.value = tile.value;
            tileDiv.id = `tile-${index}-${Date.now()}`; // Unique ID for drag/drop

            tileDiv.addEventListener('dragstart', handleDragStart);
            tileDiv.addEventListener('dragend', handleDragEnd);

            playerTilesElement.appendChild(tileDiv);
        });
    }

    // --- Drag and Drop Handlers (Basic) ---
    let draggedTile = null; // To store the tile being dragged

    function handleDragStart(event) {
        draggedTile = event.target;
        event.dataTransfer.setData('text/plain', event.target.id);
        event.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            event.target.classList.add('dragging'); // Style when dragging
        }, 0);
    }

    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        draggedTile = null;
        // Clear any hover effects on board cells
        document.querySelectorAll('#game-board td.droppable-hover').forEach(cell => {
            cell.classList.remove('droppable-hover');
        });
    }

    function handleDragOver(event) {
        event.preventDefault(); // Necessary to allow dropping
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnterBoardCell(event) {
        if (event.target.tagName === 'TD' && !event.target.hasChildNodes()) { // Only allow drop on empty cells
            event.target.classList.add('droppable-hover');
        }
    }

    function handleDragLeaveBoardCell(event) {
        if (event.target.tagName === 'TD') {
            event.target.classList.remove('droppable-hover');
        }
    }

    function handleDropOnBoard(event) {
        event.preventDefault();
        const targetCell = event.target.closest('td'); // Ensure we get the TD
        targetCell.classList.remove('droppable-hover');

        if (draggedTile && targetCell && !targetCell.hasChildNodes()) { // Only drop on empty cells
            // If tile is from hand, remove from hand data structure (actual removal later)
            // For now, just move the DOM element
            const tileElement = document.getElementById(event.dataTransfer.getData('text/plain'));

            if (tileElement) {
                // Update boardState (basic)
                const row = parseInt(targetCell.dataset.row);
                const col = parseInt(targetCell.dataset.col);
                boardState[row][col] = { letter: tileElement.dataset.letter, value: parseInt(tileElement.dataset.value) };

                // Visually move the tile
                targetCell.appendChild(tileElement);
                // Prevent further dragging of this tile from the board for now
                tileElement.draggable = false;
                // Style it as a board tile (maybe slightly different)
                tileElement.classList.add('placed-on-board');
                tileElement.classList.remove('dragging');

                // Logic to remove from playerHand array will be needed here
                // And potentially refill hand
                // For now, this is a visual move. A robust solution needs to update playerHand array.
            }
            draggedTile = null;
        }
    }

    // --- Game Controls Event Listeners ---
    document.getElementById('shuffle-tiles').addEventListener('click', () => {
        // Basic shuffle: just re-render. A better shuffle would re-order playerHand array
        if (playerHand.length > 0) {
            for (let i = playerHand.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [playerHand[i], playerHand[j]] = [playerHand[j], playerHand[i]];
            }
            renderPlayerHand();
        }
    });

    document.getElementById('reset-game').addEventListener('click', initializeGame);


    // --- Initialization ---
    function initializeGame() {
        boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        createBoard(); // Render the board
        initializeTileBag();
        playerHand = []; // Clear hand before drawing
        refillPlayerHand(); // Draw initial tiles for player 1
        // TODO: Initialize scores, current player, etc.
        document.getElementById('player1-score').textContent = "Player 1 Score: 0";
        document.getElementById('player2-score').textContent = "Player 2 Score: 0";
        document.getElementById('current-turn').textContent = "Current Turn: Player 1";

        console.log("Game Initialized. Tile bag size:", tileBag.length);
        console.log("Player hand:", playerHand);
    }

    initializeGame(); // Start the game when the script loads
});
