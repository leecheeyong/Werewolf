const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = socketIo(server)

app.use(express.static("public"))

const rooms = new Map()

class WerewolfGame {
  constructor(roomId) {
    this.id = roomId
    this.players = new Map()
    this.gameState = "waiting" // waiting, night, day, voting, ended
    this.phase = 1
    this.roles = {
      werewolves: new Set(),
      seer: null,
      doctor: null,
      witch: null,
      hunter: null,
      villagers: new Set(),
    }
    this.nightActions = {
      werewolfKill: null,
      seerCheck: null,
      doctorSave: null,
      witchPoison: null,
      witchAntidote: null,
    }
    this.votes = new Map()
    this.timeLeft = 0
    this.timer = null
    this.messages = []
    this.eliminatedTonight = null
    this.seerResult = null
    this.gameHistory = []
    this.behaviorTracker = new Map() // Track player behavior patterns
    this.hunterRevenge = null // Track if hunter needs to take revenge
  }

  addPlayer(playerId, playerName) {
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      role: null,
      alive: true,
      votes: 0,
    })
  }

  removePlayer(playerId) {
    this.players.delete(playerId)
    this.roles.werewolves.delete(playerId)
    if (this.roles.seer === playerId) this.roles.seer = null
    if (this.roles.doctor === playerId) this.roles.doctor = null
    if (this.roles.witch === playerId) this.roles.witch = null
    if (this.roles.hunter === playerId) this.roles.hunter = null
    this.roles.villagers.delete(playerId)
    this.votes.delete(playerId)
  }

  startGame() {
    if (this.players.size < 4) return false

    this.gameState = "night"
    this.assignRoles()
    this.startNightPhase()
    return true
  }

  assignRoles() {
    const playerIds = Array.from(this.players.keys())
    const playerCount = playerIds.length

    // Calculate role distribution
    const werewolfCount = Math.max(1, Math.floor(playerCount / 4))
    const hasSeer = playerCount >= 5
    const hasDoctor = playerCount >= 6
    const hasWitch = playerCount >= 7
    const hasHunter = playerCount >= 8

    // Shuffle players
    const shuffled = playerIds.sort(() => 0.5 - Math.random())
    let index = 0

    // Assign werewolves
    for (let i = 0; i < werewolfCount; i++) {
      const playerId = shuffled[index++]
      this.players.get(playerId).role = "werewolf"
      this.roles.werewolves.add(playerId)
    }

    // Assign special roles
    if (hasSeer) {
      const playerId = shuffled[index++]
      this.players.get(playerId).role = "seer"
      this.roles.seer = playerId
    }

    if (hasDoctor) {
      const playerId = shuffled[index++]
      this.players.get(playerId).role = "doctor"
      this.roles.doctor = playerId
    }

    if (hasWitch) {
      const playerId = shuffled[index++]
      this.players.get(playerId).role = "witch"
      this.roles.witch = playerId
      this.players.get(playerId).hasPoison = true
      this.players.get(playerId).hasAntidote = true
    }

    if (hasHunter) {
      const playerId = shuffled[index++]
      this.players.get(playerId).role = "hunter"
      this.roles.hunter = playerId
    }

    // Assign remaining as villagers
    for (let i = index; i < shuffled.length; i++) {
      const playerId = shuffled[i]
      this.players.get(playerId).role = "villager"
      this.roles.villagers.add(playerId)
    }

    // Initialize behavior tracking
    playerIds.forEach((playerId) => {
      this.behaviorTracker.set(playerId, {
        votingPattern: [],
        accusations: [],
        defenses: [],
        suspicionLevel: 0,
        consistency: 1.0,
      })
    })
  }

  startNightPhase() {
    this.gameState = "night"
    this.timeLeft = 60 // 1 minute for night actions
    this.nightActions = {
      werewolfKill: null,
      seerCheck: null,
      doctorSave: null,
      witchPoison: null,
      witchAntidote: null,
    }
    this.werewolfVotes = new Map() // Reset werewolf votes
    this.eliminatedTonight = null
    this.seerResult = null
    this.startTimer()
  }

  startDayPhase() {
    this.gameState = "day"
    this.timeLeft = 180 // 3 minutes for discussion
    this.processNightActions()
    this.startTimer()
  }

  startVotingPhase() {
    this.gameState = "voting"
    this.timeLeft = 60 // 1 minute for voting
    this.votes.clear()
    this.startTimer()
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer)

    this.timer = setInterval(() => {
      this.timeLeft--

      // Broadcast timer update to all players
      io.to(this.id).emit("timer-update", { timeLeft: this.timeLeft })

      if (this.timeLeft <= 0) {
        if (this.gameState === "night") {
          this.startDayPhase()
        } else if (this.gameState === "day") {
          this.startVotingPhase()
        } else if (this.gameState === "voting") {
          this.processVotes()
        } else if (this.gameState === "hunter_revenge") {
          this.checkWinConditions()
        }

        // Send updated game state after phase change
        io.to(this.id).emit("game-state", this.getGameState())
      }
    }, 1000)
  }

  processNightActions() {
    const eliminatedPlayers = []

    // Process werewolf kill
    if (this.nightActions.werewolfKill) {
      const targetId = this.nightActions.werewolfKill
      const saved = this.nightActions.doctorSave === targetId || this.nightActions.witchAntidote === targetId

      if (!saved) {
        eliminatedPlayers.push(targetId)
      }
    }

    // Process witch poison
    if (this.nightActions.witchPoison) {
      eliminatedPlayers.push(this.nightActions.witchPoison)
    }

    // Actually eliminate players
    eliminatedPlayers.forEach((targetId) => {
      this.players.get(targetId).alive = false
      this.gameHistory.push({
        phase: this.phase,
        action: "eliminated",
        playerId: targetId,
        playerName: this.players.get(targetId).name,
        reason: "night_kill",
      })
    })

    this.eliminatedTonight = eliminatedPlayers

    // Process seer check
    if (this.nightActions.seerCheck && this.roles.seer) {
      const targetId = this.nightActions.seerCheck
      const targetRole = this.players.get(targetId).role
      this.seerResult = {
        targetId,
        targetName: this.players.get(targetId).name,
        isWerewolf: targetRole === "werewolf",
      }
    }
  }

  werewolfKill(killerId, targetId) {
    console.log(`Werewolf vote attempt: ${killerId} -> ${targetId}, gameState: ${this.gameState}`)

    if (this.gameState !== "night") {
      console.log("Not night phase")
      return false
    }
    if (!this.roles.werewolves.has(killerId)) {
      console.log("Player is not werewolf")
      return false
    }
    if (!this.players.get(targetId)?.alive) {
      console.log("Target is not alive")
      return false
    }
    if (targetId === killerId) {
      console.log("Cannot target self")
      return false
    }

    if (!this.werewolfVotes) {
      this.werewolfVotes = new Map()
    }

    this.werewolfVotes.set(killerId, targetId)
    console.log(`Werewolf vote recorded: ${killerId} -> ${targetId}`)

    const aliveWerewolves = Array.from(this.roles.werewolves).filter((id) => this.players.get(id)?.alive)

    if (this.werewolfVotes.size === aliveWerewolves.length) {
      const voteCounts = new Map()
      for (const [voter, target] of this.werewolfVotes) {
        voteCounts.set(target, (voteCounts.get(target) || 0) + 1)
      }

      let maxVotes = 0
      let chosenTarget = null
      for (const [target, votes] of voteCounts) {
        if (votes > maxVotes) {
          maxVotes = votes
          chosenTarget = target
        }
      }

      if (chosenTarget) {
        this.nightActions.werewolfKill = chosenTarget
        console.log(`Werewolves chose target: ${chosenTarget}`)
      }
    }

    return true
  }

  seerCheck(seerId, targetId) {
    if (this.gameState !== "night") return false
    if (this.roles.seer !== seerId) return false
    if (!this.players.get(targetId)?.alive) return false
    if (targetId === seerId) return false

    this.nightActions.seerCheck = targetId
    return true
  }

  doctorSave(doctorId, targetId) {
    if (this.gameState !== "night") return false
    if (this.roles.doctor !== doctorId) return false
    if (!this.players.get(targetId)?.alive) return false

    this.nightActions.doctorSave = targetId
    return true
  }

  witchPoison(witchId, targetId) {
    if (this.gameState !== "night") return false
    if (this.roles.witch !== witchId) return false
    if (!this.players.get(witchId)?.hasPoison) return false
    if (!this.players.get(targetId)?.alive) return false
    if (targetId === witchId) return false

    this.nightActions.witchPoison = targetId
    this.players.get(witchId).hasPoison = false
    return true
  }

  witchAntidote(witchId, targetId) {
    if (this.gameState !== "night") return false
    if (this.roles.witch !== witchId) return false
    if (!this.players.get(witchId)?.hasAntidote) return false
    if (!this.players.get(targetId)?.alive) return false

    this.nightActions.witchAntidote = targetId
    this.players.get(witchId).hasAntidote = false
    return true
  }

  vote(voterId, targetId) {
    if (this.gameState !== "voting") return false
    if (!this.players.get(voterId)?.alive) return false
    if (!this.players.get(targetId)?.alive) return false

    this.votes.set(voterId, targetId)
    return true
  }

  processVotes() {
    const voteCounts = new Map()
    const voterBehavior = new Map()

    for (const [voterId, targetId] of this.votes) {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1)

      const behavior = this.behaviorTracker.get(voterId)
      if (behavior) {
        behavior.votingPattern.push({
          phase: this.phase,
          target: targetId,
          timestamp: new Date(),
        })
      }
    }

    let maxVotes = 0
    let eliminated = null

    for (const [playerId, votes] of voteCounts) {
      if (votes > maxVotes) {
        maxVotes = votes
        eliminated = playerId
      }
    }

    if (eliminated && maxVotes > 0) {
      const eliminatedPlayer = this.players.get(eliminated)
      eliminatedPlayer.alive = false

      if (eliminatedPlayer.role === "hunter") {
        this.hunterRevenge = eliminated
        this.gameState = "hunter_revenge"
        this.timeLeft = 30 // 30 seconds for hunter to choose
        this.startTimer()
        return
      }

      this.gameHistory.push({
        phase: this.phase,
        action: "eliminated",
        playerId: eliminated,
        playerName: eliminatedPlayer.name,
        playerRole: eliminatedPlayer.role,
        reason: "voted_out",
        votes: maxVotes,
      })
    }

    this.checkWinConditions()
  }

  hunterKill(hunterId, targetId) {
    if (this.gameState !== "hunter_revenge") return false
    if (this.hunterRevenge !== hunterId) return false
    if (!this.players.get(targetId)?.alive) return false

    this.players.get(targetId).alive = false
    this.gameHistory.push({
      phase: this.phase,
      action: "eliminated",
      playerId: targetId,
      playerName: this.players.get(targetId).name,
      playerRole: this.players.get(targetId).role,
      reason: "hunter_revenge",
    })

    this.hunterRevenge = null
    this.checkWinConditions()
    return true
  }

  checkWinConditions() {
    const alivePlayers = Array.from(this.players.values()).filter((p) => p.alive)
    const aliveWerewolves = alivePlayers.filter((p) => p.role === "werewolf").length
    const aliveVillagers = alivePlayers.filter((p) => p.role !== "werewolf").length

    if (aliveWerewolves === 0) {
      this.gameState = "ended"
      this.winner = "villagers"
    } else if (aliveWerewolves >= aliveVillagers) {
      this.gameState = "ended"
      this.winner = "werewolves"
    } else {
      this.phase++
      this.startNightPhase()
    }

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  analyzeBehavior(playerId) {
    const behavior = this.behaviorTracker.get(playerId)
    if (!behavior) return null

    const analysis = {
      suspicionLevel: behavior.suspicionLevel,
      consistency: behavior.consistency,
      votingPattern: behavior.votingPattern.slice(-3), 
      recommendations: [],
    }

    if (behavior.votingPattern.length >= 2) {
      const recentVotes = behavior.votingPattern.slice(-2)
      if (this.detectSuspiciousVoting(recentVotes)) {
        analysis.suspicionLevel += 0.2
        analysis.recommendations.push("Inconsistent voting pattern detected")
      }
    }

    return analysis
  }

  detectSuspiciousVoting(votes) {
    const targets = votes.map((v) => v.target)
    return new Set(targets).size === targets.length && targets.length > 1
  }

  addMessage(playerId, message) {
    const player = this.players.get(playerId)
    if (!player || !player.alive) return

    if (this.gameState !== "day") return

    this.analyzeMessage(playerId, message)

    this.messages.push({
      id: Date.now(),
      playerId,
      playerName: player.name,
      message,
      timestamp: new Date(),
    })

    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50)
    }
  }

  analyzeMessage(playerId, message) {
    const behavior = this.behaviorTracker.get(playerId)
    if (!behavior) return

    const lowerMessage = message.toLowerCase()

    if (
      lowerMessage.includes("werewolf") ||
      lowerMessage.includes("wolf") ||
      lowerMessage.includes("suspicious") ||
      lowerMessage.includes("vote")
    ) {
      behavior.accusations.push({
        phase: this.phase,
        message: message,
        timestamp: new Date(),
      })
    }

    if (lowerMessage.includes("not me") || lowerMessage.includes("innocent") || lowerMessage.includes("trust me")) {
      behavior.defenses.push({
        phase: this.phase,
        message: message,
        timestamp: new Date(),
      })
    }
  }

  getGameState() {
    return {
      id: this.id,
      gameState: this.gameState,
      phase: this.phase,
      timeLeft: this.timeLeft,
      players: Array.from(this.players.values()),
      messages: this.messages,
      winner: this.winner,
      eliminatedTonight: this.eliminatedTonight,
      gameHistory: this.gameHistory,
      nightActionsComplete: this.getNightActionsStatus(),
      hunterRevenge: this.hunterRevenge,
    }
  }

  getNightActionsStatus() {
    if (this.gameState !== "night") return {}

    const aliveWerewolves = Array.from(this.roles.werewolves).filter((id) => this.players.get(id)?.alive)
    const werewolfVotesComplete = this.werewolfVotes ? this.werewolfVotes.size === aliveWerewolves.length : false

    return {
      werewolfKill: werewolfVotesComplete,
      werewolfVotes: this.werewolfVotes ? Array.from(this.werewolfVotes.entries()) : [],
      seerCheck: this.roles.seer ? !!this.nightActions.seerCheck : true,
      doctorSave: this.roles.doctor ? !!this.nightActions.doctorSave : true,
      witchPoison: this.roles.witch ? !!this.nightActions.witchPoison : true,
      witchAntidote: this.roles.witch ? !!this.nightActions.witchAntidote : true,
    }
  }

  getPlayerRole(playerId) {
    const player = this.players.get(playerId)
    if (!player) return null

    const roleInfo = {
      role: player.role,
      werewolves: player.role === "werewolf" ? Array.from(this.roles.werewolves) : [],
      seerResult: player.id === this.roles.seer ? this.seerResult : null,
    }

    return roleInfo
  }

  getPlayerAnalysis(playerId) {
    return this.analyzeBehavior(playerId)
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  socket.on("join-room", ({ roomId, playerName }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new WerewolfGame(roomId))
    }

    const room = rooms.get(roomId)
    room.addPlayer(socket.id, playerName)

    socket.join(roomId)
    socket.roomId = roomId
    socket.playerName = playerName

    io.to(roomId).emit("game-state", room.getGameState())

    if (room.gameState !== "waiting") {
      socket.emit("role-assigned", room.getPlayerRole(socket.id))
    }
  })

  socket.on("start-game", () => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.startGame()) {
      io.to(socket.roomId).emit("game-state", room.getGameState())

      for (const [playerId] of room.players) {
        io.to(playerId).emit("role-assigned", room.getPlayerRole(playerId))
      }
    }
  })

  socket.on("werewolf-kill", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.werewolfKill(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("seer-check", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.seerCheck(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("doctor-save", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.doctorSave(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("witch-poison", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.witchPoison(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("witch-antidote", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.witchAntidote(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("send-message", ({ message }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room) {
      room.addMessage(socket.id, message)
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("vote", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.vote(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("hunter-kill", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room && room.hunterKill(socket.id, targetId)) {
      io.to(socket.roomId).emit("game-state", room.getGameState())
    }
  })

  socket.on("get-analysis", ({ targetId }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room) {
      const analysis = room.getPlayerAnalysis(targetId)
      socket.emit("player-analysis", { targetId, analysis })
    }
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)

    if (socket.roomId) {
      const room = rooms.get(socket.roomId)
      if (room) {
        room.removePlayer(socket.id)

        if (room.players.size === 0) {
          rooms.delete(socket.roomId)
        } else {
          io.to(socket.roomId).emit("game-state", room.getGameState())
        }
      }
    }
  })

  socket.on("timer-update", ({ timeLeft }) => {
    if (!socket.roomId) return

    const room = rooms.get(socket.roomId)
    if (room) {
      io.to(socket.roomId).emit("timer-update", { timeLeft: room.timeLeft })
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
