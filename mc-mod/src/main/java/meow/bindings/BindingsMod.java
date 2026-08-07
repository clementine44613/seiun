package meow.bindings;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.api.ModInitializer;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.WorldSavePath;
import org.spongepowered.asm.mixin.gen.Accessor;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

public class BindingsMod implements ModInitializer {
    private static volatile long lastFileCheck = 0;
    private static volatile Map<String, Entry> cachedBindings = Map.of();
    private static final Object lock = new Object();
    private static final Gson GSON = new Gson();

    @Override
    public void onInitialize() {
    }

    public static String getBindingForUsername(String username, MinecraftServer server) {
        if (server == null) return null;
        Map<String, Entry> map = loadBindings(server);
        if (map == null) return null;
        String lower = username.toLowerCase();
        for (Entry entry : map.values()) {
            if (entry != null && entry.username != null && entry.username.toLowerCase().equals(lower)) {
                return entry.username;
            }
        }
        return null;
    }

    public static boolean isUuidBoundToUsername(UUID uuid, String username, MinecraftServer server) {
        if (server == null || uuid == null || username == null) return false;
        Path worldRoot = server.getSavePath(WorldSavePath.ROOT);
        Path serverRoot = worldRoot.getParent() != null ? worldRoot.getParent() : worldRoot;
        Path whitelistPath = serverRoot.resolve("whitelist.json");
        if (!Files.exists(whitelistPath)) {
            whitelistPath = worldRoot.resolve("whitelist.json");
        }
        if (!Files.exists(whitelistPath)) return false;

        try (BufferedReader reader = Files.newBufferedReader(whitelistPath)) {
            com.google.gson.JsonArray array = com.google.gson.JsonParser.parseReader(reader).getAsJsonArray();
            for (com.google.gson.JsonElement el : array) {
                com.google.gson.JsonObject obj = el.getAsJsonObject();
                String name = obj.get("name").getAsString();
                String uuidStr = obj.get("uuid").getAsString();
                if (name.equalsIgnoreCase(username) && uuidStr.equalsIgnoreCase(uuid.toString())) {
                    return true;
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    public static Map<String, Entry> loadBindings(MinecraftServer server) {
        long now = System.currentTimeMillis();
        if (now - lastFileCheck < 5000) {
            return cachedBindings;
        }
        synchronized (lock) {
            if (now - lastFileCheck < 5000) {
                return cachedBindings;
            }
            try {
                if (server == null) {
                    return cachedBindings;
                }
                Path worldRoot = server.getSavePath(WorldSavePath.ROOT);
                Path serverRoot = worldRoot.getParent() != null ? worldRoot.getParent() : worldRoot;
                Path path = serverRoot.resolve("bindings.json");
                if (!Files.exists(path)) {
                    path = worldRoot.resolve("bindings.json");
                }
                if (Files.exists(path)) {
                    try (BufferedReader reader = Files.newBufferedReader(path)) {
                        Map<String, Object> raw = GSON.fromJson(reader, new TypeToken<Map<String, Object>>() {}.getType());
                        if (raw != null) {
                            Map<String, Entry> converted = new java.util.HashMap<>();
                            for (Map.Entry<String, Object> e : raw.entrySet()) {
                                if (e.getValue() instanceof String s) {
                                    converted.put(e.getKey(), new Entry(s, 0));
                                } else if (e.getValue() instanceof java.util.Map<?, ?> m) {
                                    Object u = m.get("username");
                                    Object v = m.get("lastVerified");
                                    String uname = u != null ? u.toString() : null;
                                    long lv = 0;
                                    if (v != null) {
                                        try { lv = Long.parseLong(v.toString()); } catch (Exception ignored) {}
                                    }
                                    if (uname != null) {
                                        converted.put(e.getKey(), new Entry(uname, lv));
                                    }
                                }
                            }
                            cachedBindings = java.util.Collections.unmodifiableMap(converted);
                        } else {
                            cachedBindings = Map.of();
                        }
                    } catch (Exception e) {
                        return cachedBindings;
                    }
                } else {
                    cachedBindings = Map.of();
                }
                lastFileCheck = now;
            } catch (Exception e) {
                return cachedBindings;
            }
        }
        return cachedBindings;
    }

    private static class Entry {
        String username;
        long lastVerified;
        Entry() {}
        Entry(String username, long lastVerified) {
            this.username = username;
            this.lastVerified = lastVerified;
        }
    }
}
