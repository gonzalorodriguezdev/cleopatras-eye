-- Passive observer only: never calls auction queries, buys, posts or changes Auctionator data.
local installed = false
local function Install()
  if installed or not Auctionator or not Auctionator.Database or type(Auctionator.Database.SetPrice) ~= "function" then return end
  installed = true
  if type(CLEOPATRAS_EYE_LOCAL) ~= "table" or CLEOPATRAS_EYE_LOCAL.version ~= 1 then
    CLEOPATRAS_EYE_LOCAL = { version = 1, markets = {} }
  end
  CLEOPATRAS_EYE_LOCAL.markets = CLEOPATRAS_EYE_LOCAL.markets or {}
  hooksecurefunc(Auctionator.Database, "SetPrice", function(_, key, price, available)
    if type(key) ~= "string" or not key:match("^%d+$") then return end
    if type(price) ~= "number" or price <= 0 then return end
    local realm = GetRealmName()
    local faction = UnitFactionGroup("player")
    if realm ~= "PvP" or faction ~= "Alliance" then return end
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
      if GetRealmName() ~= "PvP" or UnitFactionGroup("player") ~= "Alliance" then return end
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
  end
end
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function()
  -- Auctionator initializes its database late; keep a bounded passive initialization retry.
  local attempts = 0
  local ticker
  ticker = C_Timer.NewTicker(1, function()
    attempts = attempts + 1
    Install()
    if installed or attempts >= 60 then ticker:Cancel() end
  end)
end)
