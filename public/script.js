const io = window.io

class WerewolfGame {
  constructor() {
    this.socket = io()
    this.currentRoom = null
    this.playerRole = null
    this.gameState = null
    this.werewolves = []
    this.seerResult = null
    this.currentLang = "en"

    this.initializeElements()
    this.bindEvents()
    this.setupSocketListeners()
    this.updateLanguage()

    console.log("Werewolf game initialized successfully")
  }

  initializeElements() {
    this.langToggle = document.getElementById("lang-toggle")
    this.mainMenu = document.getElementById("main-menu")
    this.playerNameInput = document.getElementById("player-name")
    this.roomIdInput = document.getElementById("room-id")
    this.joinGameBtn = document.getElementById("join-game")
    this.gameLobby = document.getElementById("game-lobby")
    this.currentRoomId = document.getElementById("current-room-id")
    this.lobbyPlayers = document.getElementById("lobby-players")
    this.startGameBtn = document.getElementById("start-game-btn")
    this.gameScreen = document.getElementById("game-screen")
    this.gameHeader = document.getElementById("game-header")
    this.gamePhase = document.getElementById("game-phase")
    this.gameStatus = document.getElementById("game-status")
    this.timer = document.getElementById("timer")
    this.roleDisplay = document.getElementById("role-display")
    this.gamePlayers = document.getElementById("game-players")
    this.nightActionsPanel = document.getElementById("night-actions-panel")
    this.nightActions = document.getElementById("night-actions")
    this.votingPanel = document.getElementById("voting-panel")
    this.votingOptions = document.getElementById("voting-options")
    this.chatMessages = document.getElementById("chat-messages")
    this.chatInput = document.getElementById("chat-input")
    this.sendMessageBtn = document.getElementById("send-message")
    this.chatInputContainer = document.getElementById("chat-input-container")
    this.gameEvents = document.getElementById("game-events")
    this.eventsList = document.getElementById("events-list")
    this.gameOver = document.getElementById("game-over")
    this.gameResult = document.getElementById("game-result")
    this.gameResultText = document.getElementById("game-result-text")
    this.finalRoles = document.getElementById("final-roles")
    this.rolesReveal = document.getElementById("roles-reveal")
    this.playAgainBtn = document.getElementById("play-again")
    console.log("Elements initialized")
  }

  bindEvents() {
    this.langToggle.addEventListener("click", () => this.toggleLanguage())
    this.joinGameBtn.addEventListener("click", () => {
      console.log("Join game button clicked")
      this.joinGame()
    })
    this.startGameBtn.addEventListener("click", () => this.startGame())
    this.sendMessageBtn.addEventListener("click", () => this.sendMessage())
    this.playAgainBtn.addEventListener("click", () => this.returnToMenu())
    this.playerNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.joinGame()
    })
    this.roomIdInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.joinGame()
    })
    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.sendMessage()
    })
    console.log("Events bound successfully")
  }

  setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to server:", this.socket.id)
    })
    this.socket.on("disconnect", () => {
      console.log("Disconnected from server")
    })
    this.socket.on("game-state", (gameState) => {
      console.log("Received game state:", gameState)
      this.gameState = gameState
      this.updateGameDisplay()
    })
    this.socket.on("timer-update", ({ timeLeft }) => {
      if (this.gameState) {
        this.gameState.timeLeft = timeLeft
        this.timer.textContent = this.formatTime(timeLeft)
      }
    })
    this.socket.on("role-assigned", (roleInfo) => {
      console.log("Role assigned:", roleInfo)
      this.playerRole = roleInfo.role
      this.werewolves = roleInfo.werewolves || []
      this.seerResult = roleInfo.seerResult
      this.updateRoleDisplay()
    })
    this.socket.on("player-analysis", ({ targetId, analysis }) => {
      this.showPlayerAnalysis(targetId, analysis)
    })
    console.log("Socket listeners set up")
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === "zh" ? "en" : "zh"
    this.langToggle.textContent = this.currentLang === "zh" ? "English" : "中文"
    this.updateLanguage()
  }

  updateLanguage() {
    const elements = document.querySelectorAll("[data-en][data-zh]")
    elements.forEach((el) => {
      const text = this.currentLang === "zh" ? el.getAttribute("data-zh") : el.getAttribute("data-en")
      el.textContent = text
    })
    const placeholderElements = document.querySelectorAll("[data-placeholder-en][data-placeholder-zh]")
    placeholderElements.forEach((el) => {
      const placeholder =
        this.currentLang === "zh" ? el.getAttribute("data-placeholder-zh") : el.getAttribute("data-placeholder-en")
      el.placeholder = placeholder
    })
  }

  joinGame() {
    const playerName = this.playerNameInput.value.trim()
    if (!playerName) {
      const message = this.currentLang === "zh" ? "请输入你的名字！" : "Please enter your name!"
      alert(message)
      return
    }
    const roomId = this.roomIdInput.value.trim() || this.generateRoomId()
    this.currentRoom = roomId
    console.log("Attempting to join game:", { roomId, playerName })
    this.socket.emit("join-room", { roomId, playerName })
    this.showLobby()
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  startGame() {
    console.log("Starting game")
    this.socket.emit("start-game")
  }

  sendMessage() {
    const message = this.chatInput.value.trim()
    if (!message) return
    this.socket.emit("send-message", { message })
    this.chatInput.value = ""
  }

  werewolfKill(targetId) {
    console.log(
      "Werewolf killing:",
      targetId,
      "Current role:",
      this.playerRole,
      "Game state:",
      this.gameState?.gameState,
    )
    this.socket.emit("werewolf-kill", { targetId })
  }

  seerCheck(targetId) {
    console.log("Seer checking:", targetId)
    this.socket.emit("seer-check", { targetId })
  }

  doctorSave(targetId) {
    console.log("Doctor saving:", targetId)
    this.socket.emit("doctor-save", { targetId })
  }

  witchPoison(targetId) {
    console.log("Witch poisoning:", targetId)
    this.socket.emit("witch-poison", { targetId })
  }

  witchAntidote(targetId) {
    console.log("Witch using antidote on:", targetId)
    this.socket.emit("witch-antidote", { targetId })
  }

  vote(targetId) {
    console.log("Voting for:", targetId)
    this.socket.emit("vote", { targetId })
  }

  showLobby() {
    console.log("Showing lobby")
    this.mainMenu.classList.add("hidden")
    this.gameLobby.classList.remove("hidden")
    this.currentRoomId.textContent = this.currentRoom
  }

  showGame() {
    console.log("Showing game screen")
    this.gameLobby.classList.add("hidden")
    this.gameScreen.classList.remove("hidden")
  }

  showGameOver() {
    console.log("Showing game over screen")
    this.gameScreen.classList.add("hidden")
    this.gameOver.classList.remove("hidden")
  }

  returnToMenu() {
    this.gameOver.classList.add("hidden")
    this.mainMenu.classList.remove("hidden")
    this.playerNameInput.value = ""
    this.roomIdInput.value = ""
    this.currentRoom = null
    this.playerRole = null
    this.gameState = null
  }

  updateGameDisplay() {
    if (!this.gameState) return
    if (this.gameState.gameState === "waiting") {
      this.updateLobbyPlayers()
    } else if (this.gameState.gameState === "ended") {
      this.showGameOverScreen()
    } else {
      if (this.gameLobby && !this.gameLobby.classList.contains("hidden")) {
        this.showGame()
      }
      this.updateGameScreen()
    }
  }

  updateLobbyPlayers() {
    this.lobbyPlayers.innerHTML = ""
    this.gameState.players.forEach((player) => {
      const playerDiv = document.createElement("div")
      playerDiv.className = "flex items-center space-x-3 p-3 bg-gray-700 rounded-lg border border-gray-600"
      playerDiv.innerHTML = `
                <div class="w-4 h-4 bg-green-500 rounded-full"></div>
                <span class="game-font text-lg text-white font-semibold">${player.name}</span>
            `
      this.lobbyPlayers.appendChild(playerDiv)
    })
    this.startGameBtn.disabled = this.gameState.players.length < 4
    this.startGameBtn.classList.toggle("opacity-50", this.gameState.players.length < 4)
  }

  hunterKill(targetId) {
    console.log("Hunter killing:", targetId)
    this.socket.emit("hunter-kill", { targetId })
  }

  requestAnalysis(targetId) {
    this.socket.emit("get-analysis", { targetId })
  }

  updateGameScreen() {
    this.gamePhase.textContent = this.gameState.phase
    this.timer.textContent = this.formatTime(this.gameState.timeLeft)
    this.updatePhaseDisplay()
    this.updatePlayersList()
    this.updateNightActionsPanel()
    this.updateVotingPanel()
    this.updateHunterRevengePanel()
    this.updateChat()
    this.updateGameEvents()
    const canChat =
      this.gameState.gameState === "day" && this.gameState.players.find((p) => p.id === this.socket.id)?.alive
    console.log(
      "Can chat:",
      canChat,
      "Game state:",
      this.gameState.gameState,
      "Player alive:",
      this.gameState.players.find((p) => p.id === this.socket.id)?.alive,
    )
    if (canChat) {
      this.chatInputContainer.style.display = "block"
    } else {
      this.chatInputContainer.style.display = "none"
    }
  }

  updateHunterRevengePanel() {
    if (this.gameState.gameState === "hunter_revenge" && this.gameState.hunterRevenge === this.socket.id) {
      this.votingPanel.classList.remove("hidden")
      this.votingOptions.innerHTML = ""
      const title = document.createElement("div")
      title.className = "text-orange-400 font-bold mb-4 game-font text-xl"
      title.textContent =
        this.currentLang === "zh" ? "猎人复仇 - 选择一个玩家带走" : "Hunter's Revenge - Choose a player to eliminate"
      this.votingOptions.appendChild(title)
      this.gameState.players
        .filter((p) => p.alive && p.id !== this.socket.id)
        .forEach((player) => {
          const killBtn = document.createElement("button")
          killBtn.className =
            "w-full p-3 bg-orange-700 hover:bg-orange-600 rounded-lg border-2 border-orange-500 hover:border-orange-400 transition-all duration-300 game-font text-lg font-semibold text-white"
          const buttonText = this.currentLang === "zh" ? `带走 ${player.name}` : `Eliminate ${player.name}`
          killBtn.textContent = buttonText
          killBtn.onclick = () => this.hunterKill(player.id)
          this.votingOptions.appendChild(killBtn)
        })
    }
  }

  updatePlayersList() {
    this.gamePlayers.innerHTML = ""
    this.gameState.players.forEach((player) => {
      const isWerewolf = this.werewolves.includes(player.id)
      const showRole = this.playerRole === "werewolf" && isWerewolf
      const playerDiv = document.createElement("div")
      playerDiv.className = `p-3 rounded-lg border-2 ${player.alive ? "bg-gray-700 border-gray-600" : "bg-red-900 border-red-700 opacity-60"}`
      const roleText = showRole ? (this.currentLang === "zh" ? "狼人" : "WEREWOLF") : ""
      const eliminatedText = this.currentLang === "zh" ? "已淘汰" : "ELIMINATED"
      const analysisBtn =
        (this.playerRole === "seer" || this.playerRole === "doctor") && player.alive && player.id !== this.socket.id
          ? `<button onclick="game.requestAnalysis('${player.id}')" class="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded mt-1 transition-colors">
             ${this.currentLang === "zh" ? "分析" : "Analyze"}
           </button>`
          : ""
      playerDiv.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="font-bold game-font text-lg ${player.alive ? "text-white" : "text-red-400"}">${player.name}</div>
            ${showRole ? `<div class="text-sm text-red-400 game-font font-semibold">${roleText}</div>` : ""}
            ${analysisBtn}
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-4 h-4 rounded-full ${player.alive ? "bg-green-500" : "bg-red-500"}"></div>
            ${!player.alive ? `<span class="text-sm text-red-400 game-font font-semibold">${eliminatedText}</span>` : ""}
          </div>
        </div>
      `
      this.gamePlayers.appendChild(playerDiv)
    })
  }

  updateNightActionsPanel() {
    if (this.gameState.gameState === "night") {
      const currentPlayer = this.gameState.players.find((p) => p.id === this.socket.id)
      if (!currentPlayer?.alive) {
        this.nightActionsPanel.classList.add("hidden")
        return
      }
      this.nightActionsPanel.classList.remove("hidden")
      this.nightActions.innerHTML = ""
      const alivePlayers = this.gameState.players.filter((p) => p.alive && p.id !== this.socket.id)
      if (this.playerRole === "werewolf") {
        const title = this.currentLang === "zh" ? "狼人投票 - 选择消灭目标" : "Werewolf Vote - Choose Kill Target"
        const titleDiv = document.createElement("div")
        titleDiv.className = "text-red-400 font-semibold mb-2 game-font"
        titleDiv.textContent = title
        this.nightActions.appendChild(titleDiv)
        if (this.gameState.nightActionsComplete?.werewolfVotes) {
          const votesDiv = document.createElement("div")
          votesDiv.className = "mb-4 p-3 bg-red-900 rounded border border-red-500"
          const votesTitle = document.createElement("div")
          votesTitle.className = "text-red-400 font-semibold game-font text-sm mb-2"
          votesTitle.textContent = this.currentLang === "zh" ? "狼人投票情况:" : "Werewolf Votes:"
          votesDiv.appendChild(votesTitle)
          this.gameState.nightActionsComplete.werewolfVotes.forEach(([voterId, targetId]) => {
            const voter = this.gameState.players.find((p) => p.id === voterId)
            const target = this.gameState.players.find((p) => p.id === targetId)
            if (voter && target) {
              const voteInfo = document.createElement("div")
              voteInfo.className = "text-white game-font text-sm"
              voteInfo.textContent = `${voter.name} → ${target.name}`
              votesDiv.appendChild(voteInfo)
            }
          })
          this.nightActions.appendChild(votesDiv)
        }
        const myVote = this.gameState.nightActionsComplete?.werewolfVotes?.find(
          ([voterId]) => voterId === this.socket.id,
        )
        if (myVote) {
          const myTarget = this.gameState.players.find((p) => p.id === myVote[1])
          if (myTarget) {
            const myVoteDiv = document.createElement("div")
            myVoteDiv.className = "text-green-400 font-semibold mb-2 game-font text-sm"
            myVoteDiv.textContent =
              this.currentLang === "zh" ? `你的投票: ${myTarget.name}` : `Your vote: ${myTarget.name}`
            this.nightActions.appendChild(myVoteDiv)
          }
        }
        alivePlayers.forEach((player) => {
          const actionBtn = document.createElement("button")
          const isMyVote = myVote && myVote[1] === player.id
          actionBtn.className = isMyVote
            ? "w-full p-2 mb-1 bg-green-700 border-2 border-green-400 rounded transition-colors game-font text-white font-bold"
            : "w-full p-2 mb-1 bg-red-700 hover:bg-red-600 rounded border border-red-500 transition-colors game-font text-white"
          const buttonText = this.currentLang === "zh" ? `投票消灭 ${player.name}` : `Vote to Kill ${player.name}`
          actionBtn.textContent = buttonText
          actionBtn.onclick = () => {
            console.log("Werewolf vote button clicked for:", player.id)
            this.werewolfKill(player.id)
          }
          this.nightActions.appendChild(actionBtn)
        })
        const aliveWerewolves = this.gameState.players.filter((p) => p.alive && this.werewolves.includes(p.id)).length
        const currentVotes = this.gameState.nightActionsComplete?.werewolfVotes?.length || 0
        const progressDiv = document.createElement("div")
        progressDiv.className = "mt-4 text-yellow-400 game-font text-sm text-center"
        progressDiv.textContent =
          this.currentLang === "zh"
            ? `投票进度: ${currentVotes}/${aliveWerewolves}`
            : `Voting Progress: ${currentVotes}/${aliveWerewolves}`
        this.nightActions.appendChild(progressDiv)
      } else if (this.playerRole === "seer") {
        const title = this.currentLang === "zh" ? "选择查验目标" : "Choose Check Target"
        const titleDiv = document.createElement("div")
        titleDiv.className = "text-purple-400 font-semibold mb-2 game-font"
        titleDiv.textContent = title
        this.nightActions.appendChild(titleDiv)
        alivePlayers.forEach((player) => {
          const actionBtn = document.createElement("button")
          actionBtn.className =
            "w-full p-2 mb-1 bg-purple-700 hover:bg-purple-600 rounded border border-purple-500 transition-colors game-font text-white"
          const buttonText = this.currentLang === "zh" ? `查验 ${player.name}` : `Check ${player.name}`
          actionBtn.textContent = buttonText
          actionBtn.onclick = () => this.seerCheck(player.id)
          this.nightActions.appendChild(actionBtn)
        })
        if (this.seerResult) {
          const resultDiv = document.createElement("div")
          resultDiv.className = "mt-4 p-3 bg-purple-900 rounded border border-purple-500"
          const resultText =
            this.currentLang === "zh"
              ? `${this.seerResult.targetName} 是 ${this.seerResult.isWerewolf ? "狼人" : "好人"}`
              : `${this.seerResult.targetName} is ${this.seerResult.isWerewolf ? "Werewolf" : "Villager"}`
          resultDiv.innerHTML = `
          <div class="text-purple-400 font-semibold game-font text-sm">${this.currentLang === "zh" ? "查验结果" : "Check Result"}</div>
          <div class="text-white game-font">${resultText}</div>
        `
          this.nightActions.appendChild(resultDiv)
        }
      } else if (this.playerRole === "doctor") {
        const title = this.currentLang === "zh" ? "选择拯救目标" : "Choose Save Target"
        const titleDiv = document.createElement("div")
        titleDiv.className = "text-green-400 font-semibold mb-2 game-font"
        titleDiv.textContent = title
        this.nightActions.appendChild(titleDiv)
        const allAlivePlayers = this.gameState.players.filter((p) => p.alive)
        allAlivePlayers.forEach((player) => {
          const actionBtn = document.createElement("button")
          actionBtn.className =
            "w-full p-2 mb-1 bg-green-700 hover:bg-green-600 rounded border border-green-500 transition-colors game-font text-white"
          const buttonText = this.currentLang === "zh" ? `拯救 ${player.name}` : `Save ${player.name}`
          actionBtn.textContent = buttonText
          actionBtn.onclick = () => this.doctorSave(player.id)
          this.nightActions.appendChild(actionBtn)
        })
      } else if (this.playerRole === "witch") {
        const currentPlayerData = this.gameState.players.find((p) => p.id === this.socket.id)
        if (this.gameState.nightActionsComplete && this.gameState.nightActionsComplete.werewolfKill) {
          const attackedPlayer = this.gameState.players.find((p) => p.id === this.gameState.eliminatedTonight?.[0])
          if (attackedPlayer) {
            const infoDiv = document.createElement("div")
            infoDiv.className = "mb-4 p-3 bg-red-900 rounded border border-red-500"
            const infoText =
              this.currentLang === "zh"
                ? `${attackedPlayer.name} 被狼人攻击了`
                : `${attackedPlayer.name} was attacked by werewolves`
            infoDiv.innerHTML = `
            <div class="text-red-400 font-semibold game-font text-sm">${this.currentLang === "zh" ? "攻击信息" : "Attack Info"}</div>
            <div class="text-white game-font">${infoText}</div>
          `
            this.nightActions.appendChild(infoDiv)
          }
        }
        if (currentPlayerData?.hasAntidote) {
          const antidoteTitle = this.currentLang === "zh" ? "使用解药" : "Use Antidote"
          const titleDiv = document.createElement("div")
          titleDiv.className = "text-blue-400 font-semibold mb-2 game-font"
          titleDiv.textContent = antidoteTitle
          this.nightActions.appendChild(titleDiv)
          const allAlivePlayers = this.gameState.players.filter((p) => p.alive)
          allAlivePlayers.forEach((player) => {
            const actionBtn = document.createElement("button")
            actionBtn.className =
              "w-full p-2 mb-1 bg-blue-700 hover:bg-blue-600 rounded border border-blue-500 transition-colors game-font text-white"
            const buttonText = this.currentLang === "zh" ? `救 ${player.name}` : `Save ${player.name}`
            actionBtn.textContent = buttonText
            actionBtn.onclick = () => this.witchAntidote(player.id)
            this.nightActions.appendChild(actionBtn)
          })
        }
        if (currentPlayerData?.hasPoison) {
          const poisonTitle = this.currentLang === "zh" ? "使用毒药" : "Use Poison"
          const titleDiv = document.createElement("div")
          titleDiv.className = "text-green-400 font-semibold mb-2 mt-4 game-font"
          titleDiv.textContent = poisonTitle
          this.nightActions.appendChild(titleDiv)
          alivePlayers.forEach((player) => {
            const actionBtn = document.createElement("button")
            actionBtn.className =
              "w-full p-2 mb-1 bg-green-700 hover:bg-green-600 rounded border border-green-500 transition-colors game-font text-white"
            const buttonText = this.currentLang === "zh" ? `毒死 ${player.name}` : `Poison ${player.name}`
            actionBtn.textContent = buttonText
            actionBtn.onclick = () => this.witchPoison(player.id)
            this.nightActions.appendChild(actionBtn)
          })
        }
        if (!currentPlayerData?.hasAntidote && !currentPlayerData?.hasPoison) {
          const noAbilitiesDiv = document.createElement("div")
          noAbilitiesDiv.className = "text-gray-400 game-font text-center p-4"
          noAbilitiesDiv.textContent =
            this.currentLang === "zh" ? "你已经用完了所有能力" : "You have used all your abilities"
          this.nightActions.appendChild(noAbilitiesDiv)
        }
      }
    } else {
      this.nightActionsPanel.classList.add("hidden")
    }
  }

  updateVotingPanel() {
    if (this.gameState.gameState === "voting") {
      this.votingPanel.classList.remove("hidden")
      this.votingOptions.innerHTML = ""
      const currentPlayer = this.gameState.players.find((p) => p.id === this.socket.id)
      if (!currentPlayer?.alive) {
        const noVoteText = this.currentLang === "zh" ? "你无法投票 (已淘汰)" : "You cannot vote (eliminated)"
        this.votingOptions.innerHTML = `<p class="text-gray-300 game-font text-lg">${noVoteText}</p>`
        return
      }
           this.gameState.players
        .filter((p) => p.alive && p.id !== this.socket.id)
        .forEach((player) => {
          const voteBtn = document.createElement("button")
          voteBtn.className =
            "w-full p-3 bg-gray-700 hover:bg-red-600 rounded-lg border-2 border-gray-600 hover:border-red-500 transition-all duration-300 game-font text-lg font-semibold text-white"
          const buttonText = this.currentLang === "zh" ? `投票 ${player.name}` : `Vote ${player.name}`
          voteBtn.textContent = buttonText
          voteBtn.onclick = () => this.vote(player.id)
          this.votingOptions.appendChild(voteBtn)
        })
    } else {
      this.votingPanel.classList.add("hidden")
    }
  }

  updateChat() {
    this.chatMessages.innerHTML = ""
    this.gameState.messages.forEach((msg) => {
      const msgDiv = document.createElement("div")
      msgDiv.className = "p-3 bg-gray-700 rounded-lg border border-gray-600"
      msgDiv.innerHTML = `
      <div class="flex items-center space-x-2 mb-1">
        <span class="font-bold text-blue-400 game-font text-lg">${msg.playerName}</span>
        <span class="text-sm text-gray-400">${new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="text-gray-100 game-font text-lg">${this.escapeHtml(msg.message)}</div>
    `
      this.chatMessages.appendChild(msgDiv)
    })
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight
  }

  updateGameEvents() {
    this.eventsList.innerHTML = ""
    if (this.gameState.eliminatedTonight && this.gameState.eliminatedTonight.length > 0) {
      this.gameState.eliminatedTonight.forEach((playerId) => {
        const player = this.gameState.players.find((p) => p.id === playerId)
        if (player) {
          const eventDiv = document.createElement("div")
          eventDiv.className = "text-red-400 game-font"
          const eventText =
            this.currentLang === "zh"
              ? `${player.name} 在夜晚被消灭了`
              : `${player.name} was eliminated during the night`
          eventDiv.textContent = eventText
          this.eventsList.appendChild(eventDiv)
        }
      })
    }
    this.gameState.gameHistory.slice(-3).forEach((event) => {
      if (event.reason === "voted_out") {
        const eventDiv = document.createElement("div")
        eventDiv.className = "text-yellow-400 game-font"
        const eventText =
          this.currentLang === "zh"
            ? `${event.playerName} (${this.getRoleText(event.playerRole)}) 被投票淘汰`
            : `${event.playerName} (${this.getRoleText(event.playerRole)}) was voted out`
        eventDiv.textContent = eventText
        this.eventsList.appendChild(eventDiv)
      }
    })
  }

  showPlayerAnalysis(targetId, analysis) {
    if (!analysis) return
    const player = this.gameState.players.find((p) => p.id === targetId)
    if (!player) return
    const modal = document.createElement("div")
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-lg p-6 border-2 border-blue-500 max-w-md mx-4">
        <h3 class="game-font text-xl text-blue-400 mb-4 font-bold">
          ${this.currentLang === "zh" ? `${player.name} 的行为分析` : `${player.name}'s Behavior Analysis`}
        </h3>
        <div class="space-y-3 text-gray-200 game-font">
          <div>
            <span class="text-yellow-400">${this.currentLang === "zh" ? "可疑程度" : "Suspicion Level"}:</span>
            <div class="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div class="bg-red-500 h-2 rounded-full" style="width: ${Math.min(analysis.suspicionLevel * 100, 100)}%"></div>
            </div>
          </div>
          <div>
            <span class="text-green-400">${this.currentLang === "zh" ? "一致性" : "Consistency"}:</span>
            <div class="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div class="bg-green-500 h-2 rounded-full" style="width: ${analysis.consistency * 100}%"></div>
            </div>
          </div>
          ${
            analysis.recommendations.length > 0
              ? `
            <div>
              <span class="text-purple-400">${this.currentLang === "zh" ? "建议" : "Recommendations"}:</span>
              <ul class="text-sm mt-1 space-y-1">
                ${analysis.recommendations.map((rec) => `<li>• ${rec}</li>`).join("")}
              </ul>
            </div>
          `
              : ""
          }
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                class="mt-4 w-full btn-primary px-4 py-2 rounded font-bold game-font">
          ${this.currentLang === "zh" ? "关闭" : "Close"}
        </button>
      </div>
    `
    document.body.appendChild(modal)
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove()
      }
    }, 10000)
  }

  updateRoleDisplay() {
    if (this.playerRole) {
      const roleText = this.getRoleText(this.playerRole)
      const roleColors = {
        werewolf: "text-red-400",
        seer: "text-purple-400",
        doctor: "text-green-400",
        witch: "text-blue-400",
        villager: "text-gray-400",
        hunter: "text-orange-400",
      }
      this.roleDisplay.className = `game-font text-xl font-bold ${roleColors[this.playerRole]}`
      this.roleDisplay.textContent = roleText
    }
  }

  getRoleText(role) {
    const roleTexts = {
      werewolf: { zh: "狼人", en: "WEREWOLF" },
      seer: { zh: "预言家", en: "SEER" },
      doctor: { zh: "医生", en: "DOCTOR" },
      witch: { zh: "女巫", en: "WITCH" },
      hunter: { zh: "猎人", en: "HUNTER" },
      villager: { zh: "村民", en: "VILLAGER" },
    }
    return roleTexts[role] ? roleTexts[role][this.currentLang] : role
  }

  updatePhaseDisplay() {
    const statusTexts = {
      night: { zh: "夜晚阶段", en: "NIGHT PHASE" },
      day: { zh: "白天讨论", en: "DAY DISCUSSION" },
      voting: { zh: "投票阶段", en: "VOTING PHASE" },
      hunter_revenge: { zh: "猎人复仇", en: "HUNTER'S REVENGE" },
    }
    const statusText = statusTexts[this.gameState.gameState]
    if (statusText) {
      this.gameStatus.textContent = statusText[this.currentLang]
    }
    if (this.gameState.gameState === "night") {
      this.gameScreen.className = "min-h-screen night-bg"
      this.gameHeader.className = "bg-gray-800 border-b-2 border-purple-500 p-4"
    } else if (this.gameState.gameState === "hunter_revenge") {
      this.gameScreen.className = "min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-black"
      this.gameHeader.className = "bg-gray-800 border-b-2 border-orange-500 p-4"
    } else {
      this.gameScreen.className = "min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black"
      this.gameHeader.className = "bg-gray-800 border-b-2 border-blue-500 p-4"
    }
  }

  showGameOverScreen() {
    this.showGameOver()
    if (this.gameState.winner === "villagers") {
      const winText = this.currentLang === "zh" ? "村民获胜!" : "VILLAGERS WIN!"
      const winDesc =
        this.currentLang === "zh"
          ? "正义战胜了邪恶！所有狼人都被消灭了。"
          : "Justice prevails! All werewolves have been eliminated."
      this.gameResult.textContent = winText
      this.gameResult.className = "title-font text-5xl md:text-7xl mb-8 text-blue-400"
      this.gameResultText.textContent = winDesc
    } else {
      const winText = this.currentLang === "zh" ? "狼人获胜!" : "WEREWOLVES WIN!"
      const winDesc =
        this.currentLang === "zh"
          ? "黑暗降临！狼人成功控制了村庄。"
          : "Darkness falls! The werewolves have taken control."
      this.gameResult.textContent = winText
      this.gameResult.className = "title-font text-5xl md:text-7xl mb-8 text-red-400"
      this.gameResultText.textContent = winDesc
    }
    this.rolesReveal.innerHTML = ""
    this.gameState.players.forEach((player) => {
      const roleDiv = document.createElement("div")
      roleDiv.className = `flex justify-between items-center p-2 rounded ${player.alive ? "bg-gray-700" : "bg-red-900"}`
      roleDiv.innerHTML = `
                <span class="game-font text-white">${player.name}</span>
                <span class="game-font font-semibold role-${player.role}">${this.getRoleText(player.role)}</span>
            `
      this.rolesReveal.appendChild(roleDiv)
    })
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

let game

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing werewolf game...")
  game = new WerewolfGame()
})
