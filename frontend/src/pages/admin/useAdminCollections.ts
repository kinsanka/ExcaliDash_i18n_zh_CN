import { useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import * as api from "../../api";
import type { Collection } from "../../types";

export const useAdminCollections = (navigate: NavigateFunction) => {
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCollections = async () => {
    try {
      const data = await api.getCollections();
      setCollections(data);
    } catch (err) {
      console.error("Failed to fetch collections:", err);
    }
  };

  const handleSelectCollection = (id: string | null | undefined) => {
    if (id === undefined) navigate("/");
    else if (id === null) navigate("/collections?id=unorganized");
    else navigate(`/collections?id=${id}`);
  };

  const handleCreateCollection = async (name: string) => {
    await api.createCollection(name);
    const newCollections = await api.getCollections();
    setCollections(newCollections);
  };

  const handleEditCollection = async (id: string, name: string) => {
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === id ? { ...collection, name } : collection,
      ),
    );
    await api.updateCollection(id, name);
  };

  const handleDeleteCollection = async (id: string) => {
    setCollections((prev) => prev.filter((collection) => collection.id !== id));
    await api.deleteCollection(id);
  };

  return {
    collections,
    loadCollections,
    handleSelectCollection,
    handleCreateCollection,
    handleEditCollection,
    handleDeleteCollection,
  };
};

