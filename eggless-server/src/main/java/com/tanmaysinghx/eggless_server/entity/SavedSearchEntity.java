package com.tanmaysinghx.eggless_server.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** A named Logs Explorer query, shared with everyone signed in to this Eggless. */
@Entity
@Table(name = "eggless_saved_searches")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SavedSearchEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "search_query", length = 2000)
    private String query;

    private String levels; // comma-separated, e.g. "ERROR,WARN"

    @Column(name = "time_range", length = 16)
    private String timeRange;

    private String application; // "all" or an application id

    private String environment; // "all" or an environment

    private String createdBy;

    private Instant createdAt;
}
