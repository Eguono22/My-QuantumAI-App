#property strict

#include <Trade/Trade.mqh>

input string QuantumApiBaseUrl = "http://127.0.0.1:8011";
input string QuantumBridgeSecret = "replace-me";
input string QuantumTerminalId = "mt5-demo-terminal";
input int QuantumUserId = 1;
input string ExecutionMode = "LOCAL_MT5"; // ANALYZE_ONLY, LOCAL_MT5, QUANTUM_BACKEND
input bool UseChartSymbol = true;
input string BrokerSymbolOverride = "";
input string QuantumApiAsset = "";
input string SymbolPrefixToStrip = "";
input string SymbolSuffixToStrip = "";
input string TradeTimeframe = "M15";
input int PriceHistoryBars = 120;
input string OrderType = "MARKET";
input double TradeVolume = 0.10;
input double MinimumConfidence = 0.72;
input double MaxSpreadPoints = 50.0;
input int HeartbeatSeconds = 60;
input bool AllowBuys = true;
input bool AllowSells = true;
input bool RestrictToSession = false;
input int SessionStartHour = 7;
input int SessionEndHour = 21;
input bool OnlyOnNewBar = true;
input int MinSecondsBetweenTrades = 300;
input int MaxOpenPositionsPerSymbol = 1;
input bool SkipIfSameDirectionPositionExists = true;
input int MagicNumber = 551122;
input bool EnableStopLoss = true;
input bool EnableTakeProfit = true;
input string OrderCommentPrefix = "QuantumAI";

CTrade trade;
datetime lastHeartbeatAt = 0;
datetime lastAnalyzedBarAt = 0;
datetime lastTradeAt = 0;

string ToUpperValue(string value)
{
   string output = value;
   StringToUpper(output);
   return output;
}

string EscapeJson(string value)
{
   string output = value;
   StringReplace(output, "\\", "\\\\");
   StringReplace(output, "\"", "\\\"");
   return output;
}

string ExecutionModeNormalized()
{
   return ToUpperValue(ExecutionMode);
}

ENUM_TIMEFRAMES ResolveTimeframeEnum(string timeframeValue)
{
   string tf = ToUpperValue(timeframeValue);
   if(tf == "M1")
      return PERIOD_M1;
   if(tf == "M5")
      return PERIOD_M5;
   if(tf == "M15")
      return PERIOD_M15;
   if(tf == "M30")
      return PERIOD_M30;
   if(tf == "H1")
      return PERIOD_H1;
   if(tf == "H4")
      return PERIOD_H4;
   if(tf == "D1")
      return PERIOD_D1;
   return PERIOD_M15;
}

string ResolveBrokerSymbol()
{
   if(StringLen(BrokerSymbolOverride) > 0)
      return BrokerSymbolOverride;
   if(UseChartSymbol)
      return _Symbol;
   return "EURUSD";
}

string ResolveApiAsset()
{
   if(StringLen(QuantumApiAsset) > 0)
      return ToUpperValue(QuantumApiAsset);

   string symbol = ResolveBrokerSymbol();
   if(StringLen(SymbolPrefixToStrip) > 0 && StringFind(symbol, SymbolPrefixToStrip) == 0)
      symbol = StringSubstr(symbol, StringLen(SymbolPrefixToStrip));

   if(StringLen(SymbolSuffixToStrip) > 0)
   {
      int suffixLen = StringLen(SymbolSuffixToStrip);
      int symbolLen = StringLen(symbol);
      if(symbolLen > suffixLen && StringSubstr(symbol, symbolLen - suffixLen, suffixLen) == SymbolSuffixToStrip)
         symbol = StringSubstr(symbol, 0, symbolLen - suffixLen);
   }

   return ToUpperValue(symbol);
}

int VolumeDigitsFromStep(double step)
{
   if(step <= 0.0)
      return 2;

   int digits = 0;
   double current = step;
   while(digits < 8 && MathAbs(current - MathRound(current)) > 0.0000001)
   {
      current *= 10.0;
      digits++;
   }
   return digits;
}

double NormalizeVolumeForSymbol(string symbol, double requestedVolume)
{
   double minVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   double volume = requestedVolume;
   if(minVolume > 0.0)
      volume = MathMax(minVolume, volume);
   if(maxVolume > 0.0)
      volume = MathMin(maxVolume, volume);

   if(step > 0.0)
      volume = MathFloor(volume / step) * step;

   int digits = VolumeDigitsFromStep(step);
   return NormalizeDouble(volume, digits);
}

double CurrentSpreadPoints(string symbol)
{
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(point <= 0.0 || ask <= 0.0 || bid <= 0.0)
      return 0.0;
   return (ask - bid) / point;
}

bool SessionAllowsTrading()
{
   if(!RestrictToSession)
      return true;

   MqlDateTime nowStruct;
   TimeToStruct(TimeCurrent(), nowStruct);
   int hour = nowStruct.hour;

   if(SessionStartHour == SessionEndHour)
      return true;

   if(SessionStartHour < SessionEndHour)
      return (hour >= SessionStartHour && hour < SessionEndHour);

   return (hour >= SessionStartHour || hour < SessionEndHour);
}

bool ShouldEvaluateNow(string symbol, ENUM_TIMEFRAMES timeframeEnum)
{
   if(!OnlyOnNewBar)
      return true;

   datetime barTime = iTime(symbol, timeframeEnum, 0);
   if(barTime <= 0)
      return false;
   if(barTime == lastAnalyzedBarAt)
      return false;

   lastAnalyzedBarAt = barTime;
   return true;
}

int CountOpenPositionsForSymbol(string symbol)
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) == symbol)
         count++;
   }
   return count;
}

bool HasPositionDirection(string symbol, ENUM_POSITION_TYPE desiredType)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;

      ENUM_POSITION_TYPE currentType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if(currentType == desiredType)
         return true;
   }
   return false;
}

bool TradingConditionsAllow(string symbol, string action)
{
   if(!SessionAllowsTrading())
   {
      Print("QuantumAI skipped: outside allowed session window.");
      return false;
   }

   if(MaxSpreadPoints > 0.0)
   {
      double spread = CurrentSpreadPoints(symbol);
      if(spread > MaxSpreadPoints)
      {
         Print("QuantumAI skipped: spread ", DoubleToString(spread, 1), " exceeds max ", DoubleToString(MaxSpreadPoints, 1));
         return false;
      }
   }

   if(MinSecondsBetweenTrades > 0 && lastTradeAt > 0 && (TimeCurrent() - lastTradeAt) < MinSecondsBetweenTrades)
   {
      Print("QuantumAI skipped: cooldown still active.");
      return false;
   }

   if(MaxOpenPositionsPerSymbol > 0 && CountOpenPositionsForSymbol(symbol) >= MaxOpenPositionsPerSymbol)
   {
      Print("QuantumAI skipped: open position limit reached for ", symbol);
      return false;
   }

   if(SkipIfSameDirectionPositionExists)
   {
      ENUM_POSITION_TYPE desiredType = (action == "SELL") ? POSITION_TYPE_SELL : POSITION_TYPE_BUY;
      if(HasPositionDirection(symbol, desiredType))
      {
         Print("QuantumAI skipped: same-direction position already exists on ", symbol);
         return false;
      }
   }

   return true;
}

string JsonString(string json, string key)
{
   string marker = "\"" + key + "\":";
   int start = StringFind(json, marker);
   if(start < 0)
      return "";

   start += StringLen(marker);
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\"'))
      start++;

   int end = start;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if(ch == '\"' || ch == ',' || ch == '}')
         break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

bool JsonBool(string json, string key)
{
   string marker = "\"" + key + "\":";
   int start = StringFind(json, marker);
   if(start < 0)
      return false;

   start += StringLen(marker);
   string rest = StringSubstr(json, start, 8);
   return StringFind(rest, "true") >= 0;
}

double JsonDouble(string json, string key)
{
   string value = JsonString(json, key);
   if(StringLen(value) == 0)
      return 0.0;
   return StringToDouble(value);
}

string BuildPriceSeriesJson(string symbol, ENUM_TIMEFRAMES timeframeEnum)
{
   double closes[];
   ArraySetAsSeries(closes, true);
   int copied = CopyClose(symbol, timeframeEnum, 0, PriceHistoryBars, closes);
   if(copied <= 0)
      return "[]";

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits < 0)
      digits = 5;

   string payload = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      payload += DoubleToString(closes[i], digits);
      if(i > 0)
         payload += ",";
   }
   payload += "]";
   return payload;
}

string HttpPost(string path, string payload)
{
   string url = QuantumApiBaseUrl + path;
   string headers = "Content-Type: application/json\r\nX-MQL5-Secret: " + QuantumBridgeSecret + "\r\n";
   char data[];
   char result[];
   string resultHeaders;
   StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   int timeout = 12000;
   ResetLastError();
   int responseCode = WebRequest("POST", url, headers, timeout, data, result, resultHeaders);
   if(responseCode == -1)
   {
      Print("QuantumAI WebRequest failed. Error: ", GetLastError(), ". Check MT5 WebRequest allowlist.");
      return "";
   }

   string response = CharArrayToString(result);
   if(responseCode >= 400)
      Print("QuantumAI HTTP error ", responseCode, ": ", response);

   return response;
}

string BuildBridgePayload(string apiAsset, string brokerSymbol, ENUM_TIMEFRAMES timeframeEnum)
{
   string timeframeLabel = EscapeJson(TradeTimeframe);
   string orderTypeValue = EscapeJson(ToUpperValue(OrderType));
   string priceSeries = BuildPriceSeriesJson(brokerSymbol, timeframeEnum);

   return StringFormat(
      "{\"terminal_id\":\"%s\",\"user_id\":%d,\"asset\":\"%s\",\"timeframe\":\"%s\",\"quantity\":%.4f,\"min_confidence\":%.2f,\"risk_percent\":1.0,\"order_type\":\"%s\",\"allow_buy\":%s,\"allow_sell\":%s,\"price_series\":%s}",
      EscapeJson(QuantumTerminalId),
      QuantumUserId,
      EscapeJson(apiAsset),
      timeframeLabel,
      TradeVolume,
      MinimumConfidence,
      orderTypeValue,
      AllowBuys ? "true" : "false",
      AllowSells ? "true" : "false",
      priceSeries
   );
}

void SendHeartbeat()
{
   if(TimeCurrent() - lastHeartbeatAt < HeartbeatSeconds)
      return;

   string payload = StringFormat(
      "{\"terminal_id\":\"%s\",\"user_id\":%d,\"symbols\":[\"%s\"],\"timeframe\":\"%s\"}",
      EscapeJson(QuantumTerminalId),
      QuantumUserId,
      EscapeJson(ResolveBrokerSymbol()),
      EscapeJson(TradeTimeframe)
   );

   string response = HttpPost("/trading/mql5/bridge/heartbeat", payload);
   if(response != "")
      lastHeartbeatAt = TimeCurrent();
}

bool ExecuteLocalTrade(string action, string symbol, double requestedVolume, double stopLoss, double takeProfit)
{
   double volume = NormalizeVolumeForSymbol(symbol, requestedVolume);
   if(volume <= 0.0)
   {
      Print("QuantumAI local execution skipped: invalid normalized volume.");
      return false;
   }

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits < 0)
      digits = 5;

   double sl = (EnableStopLoss && stopLoss > 0.0) ? NormalizeDouble(stopLoss, digits) : 0.0;
   double tp = (EnableTakeProfit && takeProfit > 0.0) ? NormalizeDouble(takeProfit, digits) : 0.0;
   string comment = OrderCommentPrefix + " " + ResolveApiAsset() + " " + action;

   trade.SetExpertMagicNumber(MagicNumber);

   bool sent = false;
   if(action == "BUY")
      sent = trade.Buy(volume, symbol, 0.0, sl, tp, comment);
   else if(action == "SELL")
      sent = trade.Sell(volume, symbol, 0.0, sl, tp, comment);

   if(sent)
   {
      lastTradeAt = TimeCurrent();
      Print("QuantumAI local MT5 order sent: ", action, " ", DoubleToString(volume, 2), " ", symbol,
            " | SL=", DoubleToString(sl, digits), " TP=", DoubleToString(tp, digits));
      return true;
   }

   Print("QuantumAI local MT5 order failed: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
   return false;
}

void RequestQuantumTrade()
{
   string brokerSymbol = ResolveBrokerSymbol();
   string apiAsset = ResolveApiAsset();
   ENUM_TIMEFRAMES timeframeEnum = ResolveTimeframeEnum(TradeTimeframe);

   if(!ShouldEvaluateNow(brokerSymbol, timeframeEnum))
      return;

   string mode = ExecutionModeNormalized();
   string path = "/trading/mql5/bridge/analyze";
   if(mode == "QUANTUM_BACKEND")
      path = "/trading/mql5/bridge/execute-ai";

   string payload = BuildBridgePayload(apiAsset, brokerSymbol, timeframeEnum);
   string response = HttpPost(path, payload);
   if(response == "")
      return;

   string action = ToUpperValue(JsonString(response, "action"));
   bool shouldExecute = JsonBool(response, "should_execute");
   bool backendExecuted = JsonBool(response, "executed");
   double confidence = JsonDouble(response, "confidence");
   double entryPrice = JsonDouble(response, "entry_price");
   double stopLoss = JsonDouble(response, "stop_loss");
   double takeProfit = JsonDouble(response, "take_profit");
   double quantity = JsonDouble(response, "quantity");
   if(quantity <= 0.0)
      quantity = TradeVolume;

   Print("QuantumAI response: asset=", apiAsset,
         " action=", action,
         " should_execute=", shouldExecute,
         " backend_executed=", backendExecuted,
         " confidence=", DoubleToString(confidence, 2),
         " entry=", DoubleToString(entryPrice, 5));

   if(mode != "LOCAL_MT5")
      return;

   if(!shouldExecute)
      return;

   if(action != "BUY" && action != "SELL")
   {
      Print("QuantumAI local execution skipped: action is not actionable.");
      return;
   }

   if(!TradingConditionsAllow(brokerSymbol, action))
      return;

   ExecuteLocalTrade(action, brokerSymbol, quantity, stopLoss, takeProfit);
}

int OnInit()
{
   string payload = StringFormat(
      "{\"terminal_id\":\"%s\",\"user_id\":%d,\"symbols\":[\"%s\"],\"timeframe\":\"%s\"}",
      EscapeJson(QuantumTerminalId),
      QuantumUserId,
      EscapeJson(ResolveBrokerSymbol()),
      EscapeJson(TradeTimeframe)
   );

   HttpPost("/trading/mql5/bridge/register", payload);
   EventSetTimer(HeartbeatSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SendHeartbeat();
   RequestQuantumTrade();
}

void OnTick()
{
   SendHeartbeat();
   if(!OnlyOnNewBar)
      RequestQuantumTrade();
}
