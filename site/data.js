// Site content. The admin page (/admin) saves this file; hand edits are fine as long as
// everything after "window.SITE =" stays valid JSON.
//   projects  the work cards (cover = an image under assets/, video = a YouTube id)
//   journey   oldest first; form = the sprite's outfit (lv1 tee, lv2 hoodie, lv3 blazer), evo = that level's name
//   workflow  the trail's five stops: [title, what he thinks there]
//   tools     [group, [skills]]   loot  prize money and wins   trophies  the trophy wall (prize: USD or null)

window.SITE = {
  "name": "Dhruv",
  "tagline": "A backend-focused full-stack developer who ships with AI.",
  "links": {
    "email": "dhruvpancholi457@gmail.com",
    "github": "dhruv457457",
    "linkedin": "dhruv-pancholi",
    "x": "dhruvpanch0li"
  },
  "projects": [
    {
      "name": "Patched",
      "kind": "USDC ad-space marketplace",
      "chips": [
        "Live auctions + escrow",
        "Foundry · 99 tests",
        "Privy wallets"
      ],
      "text": "Brands bid in USDC for logo spots on creators' outfits, cars and hoodies. Live auctions with anti-sniping, instant refunds when outbid, milestone escrow payouts.",
      "live": "https://monad.patched.world",
      "code": "https://github.com/dhruv457457/brandboard",
      "video": "pVGbFo1ATDU",
      "cover": "assets/cover-patched.webp"
    },
    {
      "name": "Puff",
      "kind": "Shared graph memory for coding agents",
      "chips": [
        "FalkorDB graph",
        "Claude Code · Codex · OpenCode",
        "Team lead · Graph Hacks 2026"
      ],
      "text": "A team of real coding agents shares one graph memory. Every lesson is pinned to the function it came from, so the next agent, from any vendor, starts with it. Repeated mistakes dropped from 6 to 2 of 15 in our benchmark.",
      "live": "https://puffcode.vercel.app",
      "code": "https://github.com/Shaurya01836/Puff",
      "video": "H9KgO5SBVAE",
      "cover": "assets/cover-puff.webp",
      "team": true
    },
    {
      "name": "CLOVE",
      "kind": "Multi-agent DeFi fund manager",
      "chips": [
        "ERC-7710 delegations",
        "Hand-built agent loop",
        "Base mainnet"
      ],
      "text": "A fund-manager agent splits one capped USDC grant across four worker agents, each limited on-chain. A worker told to overspend reverts at the EVM level, even under prompt injection.",
      "live": "https://clove-flame.vercel.app",
      "code": "https://github.com/dhruv457457/CLOVE",
      "video": "Eb2h3eeSKH4",
      "cover": "assets/cover-clove.webp"
    },
    {
      "name": "Kinato",
      "kind": "Voice agent for failed payments",
      "chips": [
        "Twilio voice",
        "Policy engine",
        "802 tests"
      ],
      "text": "Calls a customer after a failed Razorpay payment, finds out why, and sends a payment link only when a rules engine approves. The model can request an offer but never set the amount.",
      "live": "https://kinato.vercel.app",
      "code": "https://github.com/dhruv457457/Kinato",
      "video": "-OMjnlEXHp8",
      "cover": "assets/cover-kinato.webp"
    },
    {
      "name": "MetaCow",
      "kind": "Social DEX with copy trading",
      "chips": [
        "ERC-7715 permissions",
        "Envio indexer",
        "Pimlico bundler"
      ],
      "text": "Swaps, liquidity and a social feed of every trade. Followers grant one capped permission and their copies execute in under five seconds after the leader's trade.",
      "live": "https://metacow.vercel.app",
      "code": "https://github.com/dhruv457457/META_COW",
      "video": "X-xlVBf-b-U",
      "cover": "assets/cover-metacow.webp"
    },
    {
      "name": "Bone Dry",
      "kind": "Solvency checks for market makers",
      "chips": [
        "600 of 860 pairs over-promised",
        "Uniswap v4 hook",
        "Base + Ethereum mainnet"
      ],
      "text": "Shows, before you sign, how much of a market maker's advertised liquidity is really there. An on-chain check widens the quote as a maker gets over-promised and refuses the trade past a set limit.",
      "live": "https://bone-dry.vercel.app",
      "code": "https://github.com/dhruv457457/Bone-Dry",
      "cover": "assets/cover-bonedry.webp"
    }
  ],
  "journey": [
    {
      "role": "Backend Developer Intern",
      "at": "STPI Jaipur",
      "meta": "Internship · Jun – Jul 2025 · Jaipur",
      "form": "lv1",
      "evo": "Intern",
      "points": [
        "Co-built a hackathon management platform in Express and Node.js on a team of four.",
        "Designed the MongoDB Atlas data models and implemented GitHub and Google sign-in.",
        "Built role-based judge assignment so each judge only sees and scores their projects."
      ],
      "tech": [
        "Express",
        "Node.js",
        "MongoDB Atlas",
        "OAuth"
      ]
    },
    {
      "role": "Founding Engineer",
      "at": "deden.space",
      "meta": "Contract · Oct 2025 – Mar 2026 · Remote",
      "form": "lv2",
      "evo": "Founding Engineer",
      "points": [
        "Built the crypto-payment booking and ticketing system in TypeScript and Node.js: Google sign-in, wallet connection through Reown, and stablecoin checkout.",
        "Automated fulfilment: tickets emailed through Resend the moment payment confirms, and QR check-in at the venue entrance.",
        "Built the admin dashboard for bookings, payments and attendance.",
        "Deployed and maintained production releases as one of two engineers."
      ],
      "tech": [
        "TypeScript",
        "Node.js",
        "Reown",
        "Resend",
        "Stablecoins"
      ]
    },
    {
      "role": "Open source",
      "at": "HackerRank hiring-agent",
      "meta": "Issue #459 · PR #460 (open) · Oct 2026",
      "form": "lv3",
      "evo": "Open-source contributor",
      "points": [
        "Found that résumés linking GitHub as GitHub.com/user were scored with no GitHub data. Reproduced it end to end, then shipped a 3-line fix with 8 unit tests."
      ],
      "tech": [
        "Python",
        "Testing"
      ]
    }
  ],
  "tools": [
    [
      "Languages",
      [
        "TypeScript",
        "JavaScript",
        "Solidity",
        "SQL",
        "C++",
        "Python"
      ]
    ],
    [
      "Backend",
      [
        "Node.js",
        "Express",
        "REST",
        "Webhooks",
        "WebSockets",
        "GraphQL",
        "Cron"
      ]
    ],
    [
      "Data",
      [
        "PostgreSQL",
        "Supabase",
        "MongoDB"
      ]
    ],
    [
      "Frontend",
      [
        "React",
        "Next.js",
        "Tailwind",
        "wagmi",
        "viem"
      ]
    ],
    [
      "Web3",
      [
        "Foundry",
        "Hardhat",
        "ERC-4337",
        "ERC-7715",
        "Uniswap v4",
        "The Graph",
        "Pimlico"
      ]
    ],
    [
      "AI",
      [
        "OpenRouter",
        "Agent loops",
        "LangGraph",
        "Claude Code",
        "Codex"
      ]
    ]
  ],
  "loot": {
    "total": 10000,
    "wins": 10
  },
  "trophies": [
    {
      "prize": 4000,
      "place": "Global Prize",
      "event": "EDU Chain Semester 3",
      "project": "Cryptify",
      "note": "Username payments + freelance escrow. Team of four.",
      "year": 2025
    },
    {
      "prize": 1100,
      "place": "2nd + Best Socials",
      "event": "MetaMask Advanced Permissions Cook-Off",
      "project": "MetaCow",
      "note": "Social DEX with copy trading.",
      "year": 2025,
      "solo": true
    },
    {
      "prize": 1000,
      "place": "2nd place",
      "event": "MetaMask × HackQuest DevCook",
      "project": "Soluma",
      "note": "Seedless event ticketing on Solana. Team of two.",
      "year": 2025
    },
    {
      "prize": 833,
      "place": "3rd + 1st Chain for Good",
      "event": "MetaMask × HackQuest DevCook",
      "project": "PayPact",
      "note": "Two tracks, one project.",
      "year": 2025
    },
    {
      "prize": 350,
      "place": "ENS track winner",
      "event": "ETHGlobal HackMoney",
      "project": "Kite",
      "note": "Shipped to mainnet in 4 days, out of 620 projects.",
      "year": 2026
    },
    {
      "prize": 600,
      "place": "2nd place",
      "event": "LNMHacks 8.0",
      "project": "Blink",
      "note": "Permissionless Gaming track, 160+ projects.",
      "year": 2025
    },
    {
      "prize": 250,
      "place": "Winner",
      "event": "contract.dev Stagenet Hackathon",
      "project": "RebalanceVault",
      "note": "Self-rebalancing DeFi vault on the Diamond pattern.",
      "year": 2025
    },
    {
      "prize": null,
      "place": "2nd of 700",
      "event": "TEK Connect",
      "project": "Team of four",
      "note": "Out of 700 projects.",
      "year": 2024
    },
    {
      "prize": null,
      "place": "Best Project",
      "event": "Kalanidhi",
      "project": "Poornima College",
      "note": "Best Non-Final Year Project.",
      "year": 2025
    }
  ],
  "workflow": [
    [
      "Draw it first",
      "Excalidraw before code: the user, the flow, then the smallest architecture that works."
    ],
    [
      "Load the rules",
      "Skill and rules files tell the model what not to write, before it writes anything."
    ],
    [
      "Think, then type",
      "Claude plans and reasons; cheaper models do the typing. Fewer tokens, same result."
    ],
    [
      "Prototype cheap",
      "A plain HTML prototype catches wrong turns while they cost an hour, not a week."
    ],
    [
      "Trust the logs",
      "Tests and logs check everyone's work, mine and the AI's."
    ]
  ],
  "pitch": {
    "line": "Give me a task and basic clarity.",
    "tail": "I'll take it from there.",
    "roles": [
      {
        "who": "I'm hiring",
        "title": "One less person to manage.",
        "points": [
          "Ships end to end: data model, backend, payments, the UI, the deploy.",
          "Founding engineer at a live startup; real users, real money.",
          "10+ hackathon wins. Most were built in days, not months."
        ]
      },
      {
        "who": "I'm a founder",
        "title": "Fuzzy idea in, working product out.",
        "points": [
          "I sketch the user flow first, so we agree before anything is built.",
          "A clickable prototype in a day; the real thing right after.",
          "You review outcomes, not tickets. I'll tell you early if something's off."
        ]
      },
      {
        "who": "I'm a CTO",
        "title": "Code you can actually review.",
        "points": [
          "Tests first-class: 99 Foundry tests on Patched, 802 on Kinato.",
          "Logs and limits built in: agents bounded on-chain, money decided in code.",
          "AI under rules: skill files, a model split, and a human who reads the diff."
        ]
      }
    ]
  }
};
