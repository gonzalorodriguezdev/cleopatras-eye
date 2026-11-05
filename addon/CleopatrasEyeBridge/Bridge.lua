-- Passive observer only: never calls auction queries, buys, posts or changes Auctionator data.
local installed = false
local function Diagnose(state)
  if type(CLEOPATRAS_EYE_LOCAL) ~= "table" then
    CLEOPATRAS_EYE_LOCAL = { version = 1, markets = {} }
  end
  local diagnostic = CLEOPATRAS_EYE_LOCAL.diagnostic or {}
  CLEOPATRAS_EYE_LOCAL.diagnostic = diagnostic
  diagnostic.build = "2026-11-05.3"
  diagnostic.state = state
  diagnostic.realm = GetRealmName()
  diagnostic.faction = UnitFactionGroup("player")
  return diagnostic
end
local function IsConfiguredMarket()
  local realm = GetRealmName()
  -- Exact live-client alias confirmed in game on 2026-11-05. Never match arbitrary PvP realms.
  return (realm == "PvP" or realm == "CAMWOW US2 Realm 6 PvP")
    and UnitFactionGroup("player") == "Alliance"
end
local function Install()
  if installed or not Auctionator or not Auctionator.Database or type(Auctionator.Database.SetPrice) ~= "function" then return end
  installed = true
  if type(CLEOPATRAS_EYE_LOCAL) ~= "table" or CLEOPATRAS_EYE_LOCAL.version ~= 1 then
    CLEOPATRAS_EYE_LOCAL = { version = 1, markets = {} }
  end
  CLEOPATRAS_EYE_LOCAL.markets = CLEOPATRAS_EYE_LOCAL.markets or {}
  Diagnose("price hook installed")
  hooksecurefunc(Auctionator.Database, "SetPrice", function(_, key, price, available)
    local diagnostic = Diagnose("price event received")
    diagnostic.priceEvents = (diagnostic.priceEvents or 0) + 1
    if type(key) ~= "string" or not key:match("^%d+$") then return end
    if type(price) ~= "number" or price <= 0 then return end
    if not IsConfiguredMarket() then return end
    local realm, faction = "PvP", "Alliance"
    local scope = realm .. " " .. faction
    local market = CLEOPATRAS_EYE_LOCAL.markets[scope]
    if not market then
      market = { realm = realm, faction = faction, items = {} }
      CLEOPATRAS_EYE_LOCAL.markets[scope] = market
    end
    local itemID = tonumber(key)
    local info = C_Item and C_Item.GetItemInfo or GetItemInfo
    local name = info and info(itemID)
    market.items[key] = { price = math.ceil(price), quantity = available, at = GetServerTime and GetServerTime() or time(), name = name or ("Item " .. key) }
  end)
  if Auctionator.EventBus and Auctionator.FullScan and Auctionator.FullScan.Events then
    local listener = {}
    function listener:ReceiveEvent(event, raw)
      if event ~= Auctionator.FullScan.Events.ScanComplete or type(raw) ~= "table" then return end
      local diagnostic = Diagnose("full scan received")
      diagnostic.fullScans = (diagnostic.fullScans or 0) + 1
      if not IsConfiguredMarket() then return end
      local rows = {}
      for _, auction in ipairs(raw) do
        local info = auction.auctionInfo or auction.replicateInfo
        local id = type(auction.itemLink) == "string" and auction.itemLink:match("item:(%d+):")
        if info and id and type(info[3]) == "number" and info[3] > 0 and type(info[10]) == "number" and info[10] > 0 then
          rows[#rows + 1] = {itemId=tonumber(id),name=info[1] or ("Item " .. id),price=math.ceil(info[10]/info[3]),quantity=info[3],buyout=info[10]}
        end
        if #rows > 100000 then CLEOPATRAS_EYE_LOCAL.lastError="Full scan exceeds local listing limit";return end
      end
      if #rows == 0 then return end
      CLEOPATRAS_EYE_LOCAL.scans = CLEOPATRAS_EYE_LOCAL.scans or {}
      table.insert(CLEOPATRAS_EYE_LOCAL.scans,{at=GetServerTime and GetServerTime() or time(),realm="PvP",faction="Alliance",rows=rows})
      while #CLEOPATRAS_EYE_LOCAL.scans > 2 do table.remove(CLEOPATRAS_EYE_LOCAL.scans,1) end
      CLEOPATRAS_EYE_LOCAL.lastError=nil
    end
    Auctionator.EventBus:Register(listener,{Auctionator.FullScan.Events.ScanComplete})
    Diagnose("price hook and scan listener installed")
  end
end
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  Diagnose("waiting for Auctionator database")
  -- Auctionator initializes its database late; keep a bounded passive initialization retry.
  local attempts = 0
  local ticker
  ticker = C_Timer.NewTicker(1, function()
    attempts = attempts + 1
    Install()
    if not installed and attempts >= 60 then Diagnose("Auctionator database unavailable after 60 seconds") end
    if installed or attempts >= 60 then ticker:Cancel() end
  end)
end)
