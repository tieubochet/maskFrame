import { Button } from "frames.js/next";
import { frames } from "./frames";
import { appURL, formatNumber } from "../utils";

interface State {
  lastFid?: string;
}


interface MaskBalance {
  username: string;
  fid: string;
  weeklyAllowance: string;
  remainingAllowance: string;
  masks: string;
}

interface MaskRank {
  rank: string;
}

interface MaskPerTips {
  masksPerTip: string;
}

interface MaskTips {
  received: {
    senderName: string;
    amount: number;
  };
  sent: {
    receiverName: string;
    amount: number;
  };
}

const frameHandler = frames(async (ctx) => {
  interface UserData {
    name: string;
    username: string;
    fid: string;
    profileDisplayName: string;
    profileImageUrl: string;
  }

  let userData: UserData | null = null;
  let maskBalance: MaskBalance | null = null;
  let maskRank: MaskRank | null = null;
  let maskPerTips: MaskPerTips | null = null;
  let error: string | null = null;
  let isLoading = false;

  const fetchUserData = async (fid: string) => {
    isLoading = true;
    try {
      const airstackUrl = `${appURL()}/api/farscore?userId=${encodeURIComponent(
        fid
      )}`;
      const airstackResponse = await fetch(airstackUrl);
      if (!airstackResponse.ok) {
        throw new Error(
          `Airstack HTTP error! status: ${airstackResponse.status}`
        );
      }
      const airstackData = await airstackResponse.json();

      if (
        airstackData.userData.Socials.Social &&
        airstackData.userData.Socials.Social.length > 0
      ) {
        const social = airstackData.userData.Socials.Social[0];
        userData = {
          name: social.profileDisplayName || social.profileName || "Unknown",
          username: social.profileName || "unknown",
          fid: social.userId || "N/A",
          profileDisplayName: social.profileDisplayName || "N/A",
          profileImageUrl:
            social.profileImageContentValue?.image?.extraSmall ||
            social.profileImage ||
            "",
        };
      } else {
        throw new Error("No user data found");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      error = (err as Error).message;
    } finally {
      isLoading = false;
    }
  };

  const fetchMaskBalance = async (fid: string) => {
    try {
      const balanceUrl = `https://app.masks.wtf/api/balance?fid=${encodeURIComponent(
        fid
      )}`;
      const balanceResponse = await fetch(balanceUrl);
      if (!balanceResponse.ok) {
        throw new Error(
          `Mask Balance HTTP error! status: ${balanceResponse.status}`
        );
      }
      maskBalance = await balanceResponse.json();
    } catch (err) {
      console.error("Error fetching Mask Balance:", err);
      error = (err as Error).message;
    }
  };

  const fetchMaskRank = async (fid: string) => {
    try {
      const rankUrl = `https://app.masks.wtf/api/rank?fid=${encodeURIComponent(
        fid
      )}`;
      const rankResponse = await fetch(rankUrl);
      if (!rankResponse.ok) {
        throw new Error(`Mask Rank HTTP error! status: ${rankResponse.status}`);
      }
      maskRank = await rankResponse.json();
    } catch (err) {
      console.error("Error fetching Mask Rank:", err);
      error = (err as Error).message;
    }
  };

  const fetchMaskPerTips = async (fid: string) => {
    try {
      const perTipsUrl = "https://app.masks.wtf/api/masksPerTip";
      const perTipsResponse = await fetch(perTipsUrl);
      if (!perTipsResponse.ok) {
        throw new Error(
          `Mask perTips HTTP error! status: ${perTipsResponse.status}`
        );
      }
      maskPerTips = await perTipsResponse.json();
    } catch (err) {
      console.error("Error fetching Mask Rank:", err);
      error = (err as Error).message;
    }
  };

  const extractFid = (url: string): string | null => {
    try {
      const parsedUrl = new URL(url);
      let fid = parsedUrl.searchParams.get("userfid");

      //console.log("Extracted FID from URL:", fid);
      return fid;
    } catch (e) {
      console.error("Error parsing URL:", e);
      return null;
    }
  };

  let fid: string | null = null;

  if (ctx.message?.requesterFid) {
    fid = ctx.message.requesterFid.toString();
    // console.log("Using requester FID:", fid);
  } else if (ctx.url) {
    fid = extractFid(ctx.url.toString());
    //console.log("Extracted FID from URL:", fid);
  } else {
    console.log("No ctx.url available");
  }

  if (!fid && (ctx.state as State)?.lastFid) {
    fid = (ctx.state as State).lastFid ?? null;
    //console.log("Using FID from state:", fid);
  }

  // console.log("Final FID used:", fid);

  const shouldFetchData =
    fid && (!userData || (userData as UserData).fid !== fid);

  if (shouldFetchData && fid) {
    await Promise.all([
      fetchUserData(fid),
      fetchMaskBalance(fid),
      fetchMaskRank(fid),
      fetchMaskPerTips(fid),
    ]);
  }

  const getCurrentUTCTime = (): string => {
    const now = new Date();

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0"); 
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");

    return `${day}-${month}-${year}, ${hours}:${minutes}:${seconds} UTC`;
  };

  const getTimeUntilNextMondayAtFive = (): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } => {
    const now = new Date();
    const currentDay = now.getUTCDay();
  
    let nextMondayAtFive = new Date(now);
  
    if (currentDay === 1 && now.getUTCHours() < 10) {
      nextMondayAtFive.setUTCHours(10, 0, 0, 0); 
    } else {
      
      const daysUntilMonday = (8 - currentDay) % 7 || 7;
      nextMondayAtFive.setUTCDate(now.getUTCDate() + daysUntilMonday);
      nextMondayAtFive.setUTCHours(10, 0, 0, 0); 
    }
  
    const diffMs = nextMondayAtFive.getTime() - now.getTime();
  
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
    return {
      days: diffDays,
      hours: diffHours,
      minutes: diffMinutes,
      seconds: diffSeconds,
    };
  };
  

  const timeUntilNextMonday = getTimeUntilNextMondayAtFive();
  const dateNow = getCurrentUTCTime();

  const formatNumberWithCommas = (numberString: string) => {
    const number = parseInt(numberString, 10);
    if (isNaN(number)) return "0";
    return number.toLocaleString("en-US");
  };

  const SplashScreen = () => (
    <div tw="flex flex-col w-full h-full bg-[#B4D4FF] text-blue-800 font-sans">
      <div tw="flex items-center flex-grow">
        <div tw="flex flex-col items-center flex-grow rounded-lg mx-24 pt-40 bg-[#B4D4FF]">
          <div tw="flex mb-6">
            <img
              src="https://clipart.info/images/ccovers/1484942358ios-emoji-performing-arts.png"
              tw="w-36"
            />
          </div>
          <div tw="flex text-6xl p-2 mb-6 text-center">
            Check Your Masks Stats
          </div>
          <div tw="flex text-5xl p-2 mt-10 text-center">Frame created by @blacknoys</div>
        </div>
      </div>
    </div>
  );

  const ScoreScreen = () => {
    return (
      <div tw="flex flex-col w-full h-full bg-[#B4D4FF] text-blue-800 font-sans">
        <div tw="flex items-center px-8 pt-4 bg-[#B4D4FF] justify-between mr-4">
          <div tw="flex items-center">
            <img
              src={userData?.profileImageUrl}
              alt="Profile"
              tw="w-20 h-20 rounded-full mr-4 ml-6"
            />
            <div tw="flex flex-col mb-1">
              <span tw="flex text-4xl">{userData?.profileDisplayName}</span>
              <span tw="flex text-2xl">@{userData?.username}</span>
            </div>
          </div>
          <div tw="flex flex-row justify-end">
            <div tw="flex flex-col items-end mt-1">
              <span tw="text-2xl">FID: <span tw="text-[#000000]">{maskBalance?.fid}</span></span>
              <span tw="text-2xl">Rank: <span tw="text-[#000000]">{maskRank?.rank}</span></span>
            </div>
          </div>
        </div>

        <div tw="flex justify-between px-8 align-center items-center">
          <div tw="flex flex-col p-4 -pt-3 mx-auto">
            <div tw="text-4xl font-bold mb-4 text-center items-center justify-center mt-2">
              🎭 MASKS STATS 🎭
            </div>
            <div tw="flex flex-row justify-between items-center w-19/20">
              <div tw="flex w-1/3 flex-col items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
                <span tw="text-3xl">Weekly Allowance</span>
                <span tw="text-4xl text-[#ff2d00]">
                  {formatNumberWithCommas(maskBalance?.weeklyAllowance || "0")}
                </span>
              </div>
              <div tw="flex flex-col w-1/3 items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
                <span tw="text-3xl">Remaining Allowance</span>
                <span tw="text-4xl text-[#ff2d00]">
                  {formatNumberWithCommas(
                    maskBalance?.remainingAllowance || "0"
                  )}
                </span>
              </div>
              <div tw="flex flex-col w-1/3 items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
                <span tw="text-3xl">Points</span>
                <span tw="text-4xl text-[#ff2d00]">
                  {formatNumberWithCommas(maskBalance?.masks || "0")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div tw="flex justify-between px-8 align-center items-center">
          <div tw="flex flex-col p-4 -pt-3 mx-auto">
            <div tw="flex flex-row justify-between items-center w-19/20">
              <div tw="flex flex-col w-1/3 items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
                <span tw="text-3xl">Tips of the Week</span>
                <span tw="text-4xl text-[#ff2d00]">
                  {formatNumberWithCommas(maskPerTips?.masksPerTip || "0")}
                </span>
              </div>

              <div tw="flex flex-col w-1/3 items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
                <span tw="text-3xl">Remaining Tipped</span>
                <span tw="text-4xl text-[#ff2d00]">
                  {formatNumberWithCommas(
                    (
                      parseFloat(maskBalance?.remainingAllowance || "0") /
                      parseFloat(maskPerTips?.masksPerTip || "0")
                    ).toFixed(2)
                  )}
                  x
                </span>
              </div>
              <div tw="flex flex-col w-1/3 items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
                <span tw="text-3xl">Tipped</span>
                <span tw="text-4xl text-[#ff2d00]">
                  {formatNumberWithCommas(
                    (
                      parseFloat(maskBalance?.weeklyAllowance || "0") -
                      parseFloat(maskBalance?.remainingAllowance || "0")
                    ).toFixed(2)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div tw="flex justify-between px-8 align-center items-center">
          <div tw="flex flex-col p-4 -pt-1 mb-2 mx-auto w-99/100">
            <div tw="flex flex-col items-center justify-center rounded-lg border-4 p-2 mx-2 py-2 bg-white bg-opacity-90">
              <span tw="text-3xl">Reset Time</span>
              <span tw="text-4xl text-[#000000]">
                {timeUntilNextMonday.days} days, {timeUntilNextMonday.hours}{" "}
                hours, {timeUntilNextMonday.minutes} minutes,{" "}
                {timeUntilNextMonday.seconds} seconds
              </span>
            </div>
          </div>
        </div>

        <div tw="flex px-8 mb-2 ml-7 text-2xl justify-between w-95/100">
          <div>{dateNow}</div>
          <div>Frame created by @blacknoys</div>
        </div>
      </div>
    );
  };

  const shareText = encodeURIComponent(
    "Check your Masks stats here 🎭! if you like this frame, share and follow @blacknoys"
  );

  const shareUrl = `https://warpcast.com/~/compose?text=${shareText}&embeds[]=https://masksframe.vercel.app/frames${
    fid ? `?userfid=${fid}` : ""
  }`;

  const buttons = [];

  if (!userData) {
    buttons.push(
      <Button action="post" target={{ href: `${appURL()}?userfid=${fid}` }}>
        Check Status
      </Button>,
      <Button action="link" target={shareUrl}>
        Share
      </Button>
    );
  } else {
    buttons.push(
      <Button action="post" target={{ href: `${appURL()}?userfid=${fid}` }}>
        My Stats
      </Button>,
      <Button action="link" target={shareUrl}>
        Share
      </Button>
    );
  }

  return {
    image: fid && !error ? <ScoreScreen /> : <SplashScreen />,
    buttons: buttons,
  };
});

export const GET = frameHandler;
export const POST = frameHandler;
