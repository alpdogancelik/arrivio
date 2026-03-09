import { endPoints } from "./config";
export type MM1Station = {
    stationId: string;
    lambda: number;
    mu: number;
    rho: number;
    approximatedWaitingTime: number;
};

export type MM1Response = {
    slotStartIso: string;
    slotEndIso: string;
    stations: MM1Station[];
    bestStationId: string;

};


export async function fetchStationsMM1ForSlotStart(
    input: {
        slotStartIso?: string;
        slotEndIso?: string;
        slotKey?: string;
        startSlotIso?: string;
        endSlotIso?: string;
    }
): Promise<MM1Response> {
    const slotStartIso = input.slotStartIso ?? input.startSlotIso ?? "";
    const slotEndIso = input.slotEndIso ?? input.endSlotIso ?? "";

    const res = await fetch(endPoints.getStationsMM1ForSlotStart, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            slotStartIso,
            slotEndIso,
            slotKey: input.slotKey ?? null,
            // backward compatibility for older backend request parsers
            startSlotIso: slotStartIso,
            endSlotIso: slotEndIso,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to fetch stations for slot start. Status: ${res.status}. Response: ${text}`);
    }
    const data = await res.json();
    return {
        slotStartIso: data.slotStartIso,
        slotEndIso: data.slotEndIso,
        bestStationId: data?.bestStationId ?? null,
        stations: Array.isArray(data?.stations) ? data.stations : [],
    };

}

export async function enterQueue(body: {
    carrierId: string;
    stationId: string;
    slotStart: string;
    slotEnd: string;
    slotKey?: string;
}) {
    const res = await fetch(endPoints.enterQueue, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.error || "Enter queue failed");
    }

    return data;
}
